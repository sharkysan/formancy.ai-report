import { describe, expect, test } from 'vitest'
import { lineHas, pageLines } from './lines.js'
import type { PdfPage, PdfTextItem } from './read-pdf.js'

/** A run as the reader reports it: a box one font size tall, its bottom a fifth of that below the baseline. */
function run(text: string, x: number, baseline: number, size = 10, width = text.length * size * 0.5): PdfTextItem {
  return { text, x, top: baseline + 0.2 * size - size, bottom: baseline + 0.2 * size, width, height: size }
}

function page(...items: PdfTextItem[]): PdfPage {
  return { number: 1, width: 595.28, height: 841.89, items, images: [] }
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

  // Two lines of one column, a line's pitch apart, are read top to bottom
  // and never merged -- merged, two rows' keys would make one word.
  test('reads lines top to bottom, whatever order the runs were drawn in', () => {
    const lines = pageLines(page(run('second', 50, 111.7), run('first', 50, 100), run('third', 50, 123.4)))
    expect(lines.map((line) => line.text)).toEqual(['first', 'second', 'third'])
    expect(lines[0]!.top).toBeLessThan(lines[1]!.top)
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
