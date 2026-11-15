import type { BaselineShift, Block, Inline, Paragraph, ResolvedDocument, TextStyle } from '../document.js'
import { expectation, plainText, type ExpectedRefusal, type Fixture } from '../fixture.js'
import { documentOf, heading } from './build.js'
import { BODY_SIZE, SMALL_SIZE } from './geometry.js'
import { hostFonts } from './host-fonts.js'

/**
 * Runs set below or above the line (0061): a formula's digits, a unit's
 * power, an exponent, a lowered letter and a footnote's mark, each in a
 * word with text on the line, as the renderer prints them; in a column, in
 * a paragraph that wraps so that such runs stand under a line and over
 * another, in the page footer on every page, and in a host's Liberation
 * Serif. The checks read each run into the line it stands on, hold its
 * size and its move (`shiftedRuns`), and see that nothing is drawn over
 * anything (`noOverlaps`).
 *
 * And the paragraphs the renderer refuses, naming them: a word of nothing
 * but such runs, a run after a space or before one, a run whose only
 * neighbour in its word prints nothing -- as an empty field does -- and a
 * word that holds one and is wider than its column. pdfmake could set any
 * of them on a line with no text on the line beside it, laid out at the
 * small run's height and drawn into the line above.
 *
 * Not in `ALL_FIXTURES`, the corpus the renderer trial chose an engine on
 * (0005), as `SVG_FIXTURES` are not: neither trial adapter sets a run off
 * its line. The renderer answers to these beside those.
 */

/** A run of literal text, set below or above the line where `baseline` says. */
function run(text: string, baseline?: BaselineShift): Inline {
  return baseline === undefined ? { text } : { text, baseline }
}

function paragraph(runs: readonly Inline[], style: TextStyle = {}): Paragraph {
  return { kind: 'paragraph', runs, style: { size: BODY_SIZE, ...style } }
}

/** A paragraph's text as one line of extracted text reads it: what `exactText` finds. These paragraphs print no page field, which alone has no plain text. */
function lineOf(block: Paragraph): string {
  return plainText(block.runs)!
}

const WATER = paragraph([run('Water is H'), run('2', 'subscript'), run('O and carbon dioxide CO'), run('2', 'subscript'), run('.')])
const ROOM = paragraph([run('The room measures 24 m'), run('2', 'superscript'), run(' and holds 60 m'), run('3', 'superscript'), run('.')])
const RATE = paragraph([run('The rate is 4.5 × 10'), run('−3', 'superscript'), run(' per hour, and the index a'), run('i', 'subscript'), run(' runs to n.')])
const MARKED = paragraph([run('A measured value'), run('1', 'superscript'), run(' read on the day.')])
const FOOTNOTE = paragraph([run('1', 'superscript'), run('\u00a0As read on site, before noon.')], { size: SMALL_SIZE })
/** A run beside the lowered digit prints nothing, as an empty field does; the letter before it is the word's text on the line. */
const EMPTY_BESIDE = paragraph([run('H'), run('2', 'subscript'), run(''), run('O with an empty run beside its digit.')])
const IN_COLUMN = paragraph([run('In a column, SO'), run('4', 'subscript'), run(' and m'), run('3', 'superscript'), run('.')])

/**
 * Long enough to wrap across lines of the page, each of its raised and
 * lowered runs in a word of its own text, so that some stand on a line with
 * a line above them and below: the boxes of such runs reach past their
 * line's text, and must still overlap nothing.
 */
const WRAPPED = paragraph([
  run('Over the day the readings rose from 2 × 10'),
  run('−3', 'superscript'),
  run(' to 5 × 10'),
  run('−2', 'superscript'),
  run(', and the share of CO'),
  run('2', 'subscript'),
  run(' in the air rose with them; each reading is the mean of three taken one after the other at the same place, the last of them, x'),
  run('3', 'subscript'),
  run(', printed beside its unit, the cubic metre, m'),
  run('3', 'superscript'),
  run(', and its square, m'),
  run('2', 'superscript'),
  run(', on the lines that follow the first.'),
])

/** "Volumes in m³", under the page numbers, on every page. */
const FOOTER_NOTE = paragraph([run('Volumes in m'), run('3', 'superscript')], { size: SMALL_SIZE, align: 'center' })

const formulasDocument = ((): ResolvedDocument => {
  const titled = documentOf('Runs below and above the line', [
    heading('Formulas and units'),
    WATER,
    ROOM,
    RATE,
    MARKED,
    FOOTNOTE,
    EMPTY_BESIDE,
    {
      kind: 'columns',
      columns: [
        { width: 220, blocks: [IN_COLUMN] },
        { width: 'fill', blocks: [] },
      ],
    },
    WRAPPED,
  ])
  return { ...titled, pageFooter: [...titled.pageFooter, FOOTER_NOTE] }
})()

export const shiftedFormulas: Fixture = {
  id: 'shifted-formulas',
  title: "Runs set below and above the line: a formula's digits, a unit's power, an exponent, a lowered letter and a footnote's mark, each read on its line",
  document: formulasDocument,
  maxPages: 2,
  expect: expectation(formulasDocument, {
    maxPagesExpected: 1,
    exactText: [WATER, ROOM, RATE, MARKED, FOOTNOTE, EMPTY_BESIDE, IN_COLUMN].map(lineOf),
    wrappedText: [lineOf(WRAPPED)],
  }),
}

/** A paragraph in the host's Liberation Serif, opening with a marker the fontNames check holds to that face. */
const SERIF = paragraph(
  [
    run('SERIFSHIFT water H'),
    run('2', 'subscript'),
    run('O, a rate of 10'),
    run('−3', 'superscript'),
    run(', an area of 3 m'),
    run('2', 'superscript'),
    run(' and the index a'),
    run('n', 'subscript'),
    run('.'),
  ],
  { font: 'serif' },
)
const SERIF_BOLD = paragraph([run('SERIFBOLDSHIFT carbon dioxide CO'), run('2', 'subscript'), run(' in 1 m'), run('3', 'superscript'), run('.')], {
  font: 'serif',
  bold: true,
})

const serifDocument: ResolvedDocument = {
  ...documentOf('Runs below and above the line in a host face', [heading('Liberation Serif'), SERIF, SERIF_BOLD]),
  fonts: hostFonts.document.fonts!,
}

/** The PostScript name the host-fonts fixture holds a face's marker to: the one face, read once, never typed again. */
const postScriptNameOf = (marker: string): string => hostFonts.expect.fontNames.find((each) => each.text === marker)!.postScriptName

export const shiftedHostFonts: Fixture = {
  id: 'shifted-host-fonts',
  title: "Runs set below and above the line in a host's Liberation Serif, regular and bold, a raised minus among them",
  document: serifDocument,
  maxPages: 1,
  expect: expectation(serifDocument, {
    maxPagesExpected: 1,
    exactText: [SERIF, SERIF_BOLD].map(lineOf),
    fontNames: [
      { text: 'SERIFSHIFT', postScriptName: postScriptNameOf('SERIFREG') },
      { text: 'SERIFBOLDSHIFT', postScriptName: postScriptNameOf('SERIFBLD') },
    ],
  }),
}

/** A document under its heading that the renderer refuses: as `unsupported`, naming the paragraph after the heading, `body[1]`, unless `refusal` says otherwise. */
function refused(id: string, title: string, blocks: readonly Block[], refusal: ExpectedRefusal = { code: 'unsupported', subject: 'body[1]' }): Fixture {
  const document = documentOf(title, [heading(title), ...blocks])
  return { id, title, document, maxPages: 1, expect: expectation(document, { outcome: 'refuse', refusal, maxPagesExpected: 1 }) }
}

export const shiftedAlone = refused('shifted-alone', 'A word of nothing but runs set below and above the line: refused, naming the paragraph', [
  paragraph([run('2', 'subscript'), run('3', 'superscript')]),
])

export const shiftedAfterSpace = refused('shifted-after-space', "A footnote's mark after a space, a word of its own: refused, naming the paragraph", [
  paragraph([run('A measured value '), run('1', 'superscript')]),
])

export const shiftedBeforeSpace = refused('shifted-before-space', "A footnote's mark at the head of its text, before a space: refused, naming the paragraph", [
  paragraph([run('1', 'superscript'), run(' As read on site.')]),
])

export const shiftedEmptyBefore = refused(
  'shifted-empty-before',
  'A lowered digit after a run that prints nothing, its only neighbour: refused, naming the paragraph',
  [paragraph([run('Na'), run(''), run('2', 'subscript')])],
)

export const shiftedEmptyAfter = refused(
  'shifted-empty-after',
  'A raised digit before a run that prints nothing, its only neighbour in its word: refused, naming the paragraph',
  [paragraph([run('Value '), run('2', 'superscript'), run('')])],
)

export const shiftedTooWide = refused(
  'shifted-too-wide',
  'A word holding lowered digits, wider than its column: refused, naming the paragraph',
  [
    {
      kind: 'columns',
      columns: [
        { width: 40, blocks: [paragraph([run('Na'), run('2', 'subscript'), run('SO'), run('4', 'subscript'), run('·10H'), run('2', 'subscript'), run('O')])] },
        { width: 'fill', blocks: [] },
      ],
    },
  ],
  { code: 'content-too-large', subject: 'body[1].columns[0].blocks[0]' },
)

/** The fixtures of runs set below or above the line, which the renderer answers to beside `ALL_FIXTURES`. */
export const SHIFTED_FIXTURES: readonly Fixture[] = [
  shiftedFormulas,
  shiftedHostFonts,
  shiftedAlone,
  shiftedAfterSpace,
  shiftedBeforeSpace,
  shiftedEmptyBefore,
  shiftedEmptyAfter,
  shiftedTooWide,
]
