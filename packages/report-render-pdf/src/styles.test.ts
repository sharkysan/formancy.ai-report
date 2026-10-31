import { readPdf, type ReadPdf } from '@formancy/report-corpus'
import type { Block, ResolvedDocument, Table, TableRow, TextStyle } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { PADDING_X } from './table.js'
import { bareDocument, details, ledger, LEDGER_COLUMNS, paragraph, PAGE, PRINTABLE_WIDTH } from './testing/documents.js'
import { readDrawing, type DrawnPage, type Shown } from './testing/drawing.js'
import { runOf } from './testing/lines.js'

/**
 * Text styles as they print: the face each run is drawn in, as PDF.js names
 * the font and as the content stream shows it, its colour, its size and its
 * alignment, in paragraphs and in every kind of table row. A style lost on
 * the way prints in the wrong face or colour, without an error.
 */

const LEFT = PAGE.margins.left
const RIGHT = LEFT + PRINTABLE_WIDTH

async function rendered(document: ResolvedDocument): Promise<{ pdf: ReadPdf; drawing: DrawnPage[] }> {
  const bytes = await renderPdf(document, { maxPages: 5 })
  return { pdf: await readPdf(bytes), drawing: readDrawing(bytes) }
}

/** The faces PDF.js reports a PDF using, without their subset prefixes. */
function faces(pdf: ReadPdf): string[] {
  return pdf.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, '')).sort()
}

/** How the run PDF.js read as `text` was shown: the content stream's run at its place. */
function shown(pdf: ReadPdf, drawing: readonly DrawnPage[], text: string): Shown {
  const run = runOf(pdf, text)
  const baseline = run.bottom - 0.2 * run.height
  const found = drawing[run.page - 1]!.text.filter((each) => Math.abs(each.x - run.x) < 0.01 && Math.abs(each.baseline - baseline) < 0.01)
  expect(found, text).toHaveLength(1)
  return found[0]!
}

describe('the face text is drawn in', () => {
  // Bold is a font of its own, which the PDF must carry and use: the only
  // text on the page in bold, and PDF.js finds Roboto's bold face and no
  // other. pdfmake's Roboto has no heavier face than Medium.
  test.each([
    [{}, 'Roboto-Regular'],
    [{ bold: true }, 'Roboto-Medium'],
    [{ italic: true }, 'Roboto-Italic'],
    [{ bold: true, italic: true }, 'Roboto-MediumItalic'],
    [{ font: 'sans' }, 'Roboto-Regular'],
  ] as const)('a paragraph styled %j is drawn in %s, embedded', async (style, face) => {
    const { pdf } = await rendered(bareDocument('Face', [paragraph('Styled', style)]))
    expect(faces(pdf)).toEqual([face])
    expect(pdf.fonts.every((font) => font.embedded)).toBe(true)
  })

  // A run's bold is its own: in a paragraph that is not bold, that run alone
  // is drawn in the bold face.
  test('draws a bold run in bold inside a paragraph that is not', async () => {
    const { pdf, drawing } = await rendered(bareDocument('Runs', [{ kind: 'paragraph', runs: [{ text: 'Plain then ' }, { text: 'bold', bold: true }] }]))
    expect(shown(pdf, drawing, 'Plain then').font).toBe('Roboto-Regular')
    expect(shown(pdf, drawing, 'bold').font).toBe('Roboto-Medium')
  })

  // The renderer embeds Roboto alone. A serif or a monospaced report printed
  // in Roboto would be a substitution nobody sees until the PDF is read: it
  // is refused instead, naming where it was asked for.
  test.each([
    ['a paragraph in serif', [paragraph('Serif', { font: 'serif' })], 'body[0]'],
    ['a paragraph in mono', [paragraph('Mono', { font: 'mono' })], 'body[0]'],
    ['a table header in mono', [{ ...ledger('codes', details(1, 2)), headerStyle: { font: 'mono' } }], 'codes'],
    ['a table cell in serif', [ledger('codes', [{ kind: 'detail', cells: ['A', 'B', 'C'], cellStyles: [null, { font: 'serif' }, null] }])], 'codes'],
  ] as const)('refuses %s', async (_, body, subject) => {
    await expect(renderPdf(bareDocument('Font', body as readonly Block[]), { maxPages: 5 })).rejects.toMatchObject({
      code: 'unsupported',
      subject,
      message: expect.stringContaining('Roboto'),
    })
  })
})

describe('a paragraph', () => {
  // A colour lost prints black; a size lost prints the default and moves
  // every line after it.
  test('prints in its colour and at its size', async () => {
    const { pdf, drawing } = await rendered(bareDocument('Colour', [paragraph('In red', { color: '#c00000', size: 14 }), paragraph('In black')]))
    expect(shown(pdf, drawing, 'In red')).toMatchObject({ color: '#c00000', size: 14 })
    expect(shown(pdf, drawing, 'In black')).toMatchObject({ color: '#000000', size: 9 })
    expect(runOf(pdf, 'In red').height).toBeCloseTo(14, 5)
  })

  // Aligned text against the wrong edge reads as a different layout: a
  // total under a right-aligned column, a centred title.
  test.each([
    ['left', (run: { x: number; width: number }): number => run.x, LEFT],
    ['right', (run: { x: number; width: number }): number => run.x + run.width, RIGHT],
    ['center', (run: { x: number; width: number }): number => run.x + run.width / 2, (LEFT + RIGHT) / 2],
  ] as const)('aligned %s', async (align, edge, expected) => {
    const { pdf } = await rendered(bareDocument('Aligned', [paragraph('Aligned text', { align })]))
    expect(edge(runOf(pdf, 'Aligned text'))).toBeCloseTo(expected, 3)
  })
})

describe('a table', () => {
  const styled = (rows: readonly TableRow[], headerStyle?: TextStyle): Table => ({
    ...ledger('styled', rows),
    ...(headerStyle === undefined ? {} : { headerStyle }),
  })

  // The renderer's own style for each row: the header and every row but a
  // detail row in bold, all in black.
  test('prints its header and its group and total rows in bold, and its detail rows not', async () => {
    const rows: TableRow[] = [
      { kind: 'groupHeader', cells: ['Region', '', ''] },
      ...details(1, 1),
      { kind: 'groupFooter', cells: ['Subtotal', '', '1.00'] },
      { kind: 'total', cells: ['Total', '', '2.00'] },
    ]
    const { pdf, drawing } = await rendered(bareDocument('Kinds', [styled(rows)]))
    expect(['Key', 'Region', 'ROW-0001', 'Subtotal', 'Total'].map((text) => shown(pdf, drawing, text).font)).toEqual([
      'Roboto-Medium',
      'Roboto-Medium',
      'Roboto-Regular',
      'Roboto-Medium',
      'Roboto-Medium',
    ])
  })

  // A style given to the header or a row replaces the renderer's for what
  // it sets, and leaves what it does not: a total row given a colour is
  // still bold. A cell's own style is its whole style, the row's not merged
  // under it again: the other cells of the row keep the row's.
  test('prints its header, rows and cells in their own styles', async () => {
    const rows: TableRow[] = [
      { kind: 'detail', cells: ['ROW-0001', 'Strong row', '1.00'], style: { bold: true } },
      {
        kind: 'detail',
        cells: ['ROW-0002', 'Cell of its own', '2.00'],
        style: { color: '#0000c0' },
        cellStyles: [null, { color: '#c00000', italic: true }, null],
      },
      { kind: 'total', cells: ['Total', '', '3.00'], style: { color: '#008000' } },
    ]
    const { pdf, drawing } = await rendered(bareDocument('Styled rows', [styled(rows, { bold: false, color: '#606060', size: 8 })]))
    expect(shown(pdf, drawing, 'Key')).toMatchObject({ font: 'Roboto-Regular', color: '#606060', size: 8 })
    expect(shown(pdf, drawing, 'Strong row')).toMatchObject({ font: 'Roboto-Medium', color: '#000000' })
    expect(shown(pdf, drawing, 'ROW-0002')).toMatchObject({ font: 'Roboto-Regular', color: '#0000c0' })
    expect(shown(pdf, drawing, 'Cell of its own')).toMatchObject({ font: 'Roboto-Italic', color: '#c00000' })
    expect(shown(pdf, drawing, '2.00')).toMatchObject({ color: '#0000c0' })
    expect(shown(pdf, drawing, 'Total')).toMatchObject({ font: 'Roboto-Medium', color: '#008000' })
  })

  // Each column aligns its cells, and a cell's own alignment wins over its
  // column's: amounts right, a note in that column left.
  test('aligns each cell as its column does, unless the cell says otherwise', async () => {
    const rows: TableRow[] = [
      { kind: 'detail', cells: ['ROW-0001', 'Centred', '12.50'] },
      { kind: 'detail', cells: ['ROW-0002', 'Left', 'n/a'], cellStyles: [null, null, { align: 'left' }] },
    ]
    const columns = [LEDGER_COLUMNS[0]!, { width: 'fill', align: 'center' }, LEDGER_COLUMNS[2]!] as const
    const { pdf } = await rendered(bareDocument('Aligned cells', [{ ...ledger('aligned', rows, columns) }]))
    const amountColumn = { left: RIGHT - 90, right: RIGHT }
    const amount = runOf(pdf, '12.50')
    expect(amount.x + amount.width).toBeCloseTo(amountColumn.right - PADDING_X, 3)
    expect(runOf(pdf, 'n/a').x).toBeCloseTo(amountColumn.left + PADDING_X, 3)
    const centred = runOf(pdf, 'Centred')
    expect(centred.x + centred.width / 2).toBeCloseTo((LEFT + 70 + amountColumn.left) / 2, 3)
  })

  // A group header across the table is one cell over every column: printed
  // in the first column alone, a long one wraps inside 70pt over three lines.
  test('prints a row across the table as one line over every column', async () => {
    const heading = 'Region North-West, every site visited in the third quarter'
    const rows: TableRow[] = [{ kind: 'groupHeader', cells: [heading], across: true }, ...details(1, 2)]
    const { pdf } = await rendered(bareDocument('Across', [styled(rows)]))
    const run = runOf(pdf, heading)
    expect(run.x).toBeCloseTo(LEFT + PADDING_X, 3)
    expect(run.width).toBeGreaterThan(70)
  })
})
