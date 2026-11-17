import { describe, expect, test } from 'vitest'
import { lineHas, offLine, pageLines } from './lines.js'
import type { PdfPage, PdfTextItem } from './read-pdf.js'

/** A run as the reader reports it: a box one font size tall, its bottom a fifth of that below the baseline. */
function run(text: string, x: number, baseline: number, size = 10, width = text.length * size * 0.5): PdfTextItem {
  return { text, x, top: baseline + 0.2 * size - size, bottom: baseline + 0.2 * size, width, height: size, angle: 0, font: 'Test' }
}

function page(...items: PdfTextItem[]): PdfPage {
  return { number: 1, width: 595.28, height: 841.89, items, images: [], paths: [], clips: [] }
}

describe('pageLines', () => {
  // pdfmake draws a line as one run, another engine draws one run per word
  // or per cell. The checks must read the same line either way: a key split
  // into two runs at a kerning join is still one word, and two cells on a
  // row are two.
  test('joins the runs on one baseline, with a space only where there is a gap', () => {
    const lines = pageLines(page(run('0001', 70, 100, 10, 20), run('Description', 120, 100), run('ROW-', 50, 100, 10, 19.6)))
    expect(lines.map((line) => line.text)).toEqual(['ROW-0001 Description'])
    expect(lines[0]!.words).toEqual(['ROW-0001', 'Description'])
  })

  // A bold total beside a smaller label shares the baseline but not the
  // bottom of its box. Split into two lines, a row's cells would read as two
  // rows, and its key would no longer start the line that holds its amount.
  test('keeps runs of different sizes on one baseline together', () => {
    const lines = pageLines(page(run('Total', 50, 200, 7), run('1830.00', 150, 200, 20)))
    expect(lines.map((line) => line.text)).toEqual(['Total 1830.00'])
  })

  // A caption that reads up the page beside a code does not share a line
  // with the text that happens to stand where its box ends: joined to it,
  // an IBAN printed beside the code would read "DE71 ... Zahlen mit Code"
  // and match no line the report prints. A turned run is a line of its
  // own, after the lines that read across the page.
  test('reads a run that does not read across the page as a line of its own', () => {
    const caption: PdfTextItem = { text: 'Zahlen mit Code', x: 494.4, top: 690, bottom: 741.36, width: 7, height: 51.36, angle: 90, font: 'LiberationSans' }
    // Its box ends where that line's baseline is, a fifth of an em above it.
    const iban = run('DE71 1102 2033 0123 4567 89', 300, caption.bottom - 0.2 * caption.height)
    const lines = pageLines(page(caption, iban, run('Above', 50, 600)))
    expect(lines.map((line) => line.text)).toEqual(['Above', 'DE71 1102 2033 0123 4567 89', 'Zahlen mit Code'])
    expect(lines[2]).toMatchObject({ top: 690, bottom: 741.36 })
  })

  // Two lines of one column, a line's pitch apart, are read top to bottom
  // and never merged -- merged, two rows' keys would make one word.
  test('reads lines top to bottom, whatever order the runs were drawn in', () => {
    const lines = pageLines(page(run('second', 50, 111.7), run('first', 50, 100), run('third', 50, 123.4)))
    expect(lines.map((line) => line.text)).toEqual(['first', 'second', 'third'])
    expect(lines[0]!.top).toBeLessThan(lines[1]!.top)
  })
})

describe('pageLines, of a run set below or above the line (0061)', () => {
  // pdfmake draws a lowered digit at 0.58 of its line's size, its baseline
  // 0.203 of that size down: by baseline alone it is a line of its own, and
  // "H2O" is found nowhere. Read into the line beside it, the formula is one
  // word, and the run is recorded with how it was set.
  test('reads a run at SHIFTED_SIZE of the run beside it, moved by SHIFTED_RISE, into its line', () => {
    const lines = pageLines(page(run('H', 50, 100, 10, 7.13), run('2', 57.13, 102.03, 5.8, 3.26), run('O', 60.39, 100, 10, 6.88)))
    expect(lines.map((line) => line.text)).toEqual(['H2O'])
    expect(lines[0]!.shifted).toHaveLength(1)
    expect(lines[0]!.shifted[0]).toMatchObject({ text: '2', shift: 'subscript', size: 5.8 })
    expect(lines[0]!.shifted[0]!.rise).toBeCloseTo(-2.03, 6)
  })

  // A unit's power is raised 0.435 of the line's size, and a footnote's mark
  // stands a no-break space from its text. Both are read on the line they
  // belong to, the space as a reader sees it.
  test('reads a raised run into its line, against its word or a no-break space from it', () => {
    const lines = pageLines(
      page(
        run('area 12 m', 50, 200, 9, 40),
        run('2', 90, 200 - 3.915, 5.22, 2.93),
        run('total', 95.16, 200, 9, 18),
        run('1', 50, 300 - 4.35, 5.8, 3.26),
        run('Footnote text', 55.74, 300, 10, 59.19),
      ),
    )
    expect(lines.map((line) => line.text)).toEqual(['area 12 m2 total', '1 Footnote text'])
    expect(lines.map((line) => line.shifted.map(({ text, shift }) => `${text} ${shift}`))).toEqual([['2 superscript'], ['1 superscript']])
    // The raised run's box reaches above the line's own text, and the line's top is that of its highest run.
    expect(lines[0]!.top).toBeCloseTo(200 - 3.915 + 0.2 * 5.22 - 5.22, 6)
  })

  // A charge after its count, SO₄²⁻, is a lowered run and a raised one side
  // by side, and the raised run stands a lowered digit's width from the
  // letter, past JOIN_GAP of it: read against its neighbour alone it was a
  // line of its own, and the formula was found nowhere. It is read against
  // the run on the line its lowered neighbour was read against, which it
  // is drawn at the size and the move of.
  test('reads a run beside another run set off the line against the run on the line that one was read against', () => {
    const lines = pageLines(
      page(
        run('The ion is SO', 50, 100, 9, 60),
        run('4', 110, 100 + 1.827, 5.22, 2.94),
        run('2−', 112.94, 100 - 3.915, 5.22, 6.03),
        run('Next line', 50, 111.7, 9, 40),
      ),
    )
    expect(lines.map((line) => line.text)).toEqual(['The ion is SO42−', 'Next line'])
    expect(lines[0]!.shifted.map(({ text, shift }) => `${text} ${shift}`)).toEqual(['4 subscript', '2− superscript'])
    expect(lines[0]!.shifted[1]!.rise).toBeCloseTo(3.915, 6)
    // Drawn at another move from the letter, the second run is not read so, whatever its neighbour.
    const moved = pageLines(page(run('The ion is SO', 50, 100, 9, 60), run('4', 110, 100 + 1.827, 5.22, 2.94), run('2−', 112.94, 100 - 3, 5.22, 6.03)))
    expect(moved.map((line) => line.text)).toEqual(['2−', 'The ion is SO4'])
  })

  // A small run that is not where pdfmake sets one -- moved some other way,
  // drawn at another size, or standing well apart -- is a line of its own,
  // as it always was: the join reads exactly the geometry the document
  // states, so that a run drawn wrong is not read as right.
  test('keeps a small run moved otherwise, at another size or standing apart, a line of its own', () => {
    const moved = pageLines(page(run('H', 50, 100, 10, 7.13), run('2', 57.13, 103, 5.8, 3.26)))
    expect(moved.map((line) => line.text)).toEqual(['H', '2'])
    const sized = pageLines(page(run('H', 50, 100, 10, 7.13), run('2', 57.13, 102.03, 6, 3.26)))
    expect(sized.map((line) => line.text)).toEqual(['H', '2'])
    const apart = pageLines(page(run('H', 50, 100, 10, 7.13), run('2', 61.13, 102.03, 5.8, 3.26)))
    expect(apart.map((line) => line.text)).toEqual(['H', '2'])
    expect([...moved, ...sized, ...apart].flatMap((line) => line.shifted)).toEqual([])
  })

  // A line of small text beside or under a larger one -- a caption, a
  // footnote paragraph -- stays a line of its own and records nothing.
  test('keeps a line of small text a line of its own', () => {
    const lines = pageLines(page(run('Measured value', 50, 100, 10, 70), run('as read on site', 50, 110, 5.8, 40)))
    expect(lines.map((line) => line.text)).toEqual(['Measured value', 'as read on site'])
    expect(lines.flatMap((line) => line.shifted)).toEqual([])
  })
})

describe('offLine', () => {
  // A reader of lines of its own -- the renderer's tests' copy, which the
  // README's pictures are read with -- reads a run set off the line into
  // the line this reader does by asking for these runs, so that the rule
  // is stated once. Each is given with the run on the line it is read
  // against, a charge's raised run against the letter its lowered count
  // was; a run read as a line of its own is not among them.
  test('gives each run pageLines reads into another run’s line, with that run', () => {
    const letter = run('The ion is SO', 50, 100, 9, 60)
    const count = run('4', 110, 100 + 1.827, 5.22, 2.94)
    const charge = run('2−', 112.94, 100 - 3.915, 5.22, 6.03)
    const apart = run('2', 300, 102.03, 5.8, 3.26)
    const found = offLine(page(letter, count, charge, run('Next line', 50, 111.7, 9, 40), apart))
    expect([...found].map(([item, beside]) => [item.text, beside.text])).toEqual([
      ['4', 'The ion is SO'],
      ['2−', 'The ion is SO'],
    ])
  })
})

describe('lineHas', () => {
  // An exact value is found as whole words: "0.00" must not pass because
  // "10.00" or "-0.00" is printed.
  test('finds text as whole words only', () => {
    const [line] = pageLines(page(run('Total 10.00 -0.00 CHF 1’234.50', 50, 100)))
    expect(lineHas(line!, '10.00')).toBe(true)
    expect(lineHas(line!, 'CHF 1’234.50')).toBe(true)
    expect(lineHas(line!, '0.00')).toBe(false)
    expect(lineHas(line!, 'Tot')).toBe(false)
  })
})
