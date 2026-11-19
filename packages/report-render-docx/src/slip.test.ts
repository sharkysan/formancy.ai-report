import { BILL_EXAMPLES, LONG_BILL, readSlipCode, verifyDocx, type DocxBlock, type DocxParagraph, type DocxTable } from '@formancy/report-corpus'
import type { Block, QrBill } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_PARAGRAPHS } from './limits.js'
import { renderDocx } from './render.js'
import { broken, planSlip } from './slip-plan.js'
import { slipNodes } from './slip.js'
import { LIBERATION, measured } from './testing/advances.js'
import { BILLS, billDocument, resolvedBill } from './testing/bills.js'
import { LONGEST_FAMILY } from './testing/fonts.js'
import { documentOf, fixtureOf, paragraph, refusalOf, written } from './testing/support.js'

/**
 * A QR-bill's slip, proved on the file the writer produced (0075,
 * extending 0003): read back by the corpus's reader and held by the
 * corpus's check to SIX's own numbers -- the page, the lines the slip is
 * cut along, every heading and value where SIX puts it, the blank
 * fields' corner marks, and the Swiss QR Code on its picture's pixels
 * and on what ZXing reads in them. And what the corpus cannot hold,
 * since it has no face's widths: that every line fits its place, by the
 * advances the renderer's own font files give. What Word then prints is
 * not seen here.
 */

const mm = (value: number): number => (value * 72) / 25.4

describe.each(BILLS)('%s', (name, bill) => {
  const document = billDocument(resolvedBill(bill))

  // Every part of the slip where SIX puts it, on the file: a slip a section off, a value left out or a code of another payload is a bill no bank pays.
  test('is written with its slip on a page of its own, as SIX lays one out', async () => {
    expect(await verifyDocx(fixtureOf(name, document), written(document))).toEqual([])
  })

  // A line wider than its cell is one Word breaks: the line after it, and every section under it, would stand a line lower than SIX puts it.
  // Measured by the font's own tables, read by the test's own code, never by the table the writer broke the lines with.
  test('sets no line wider than its place, by the advances of the face the PDF prints it in', () => {
    const [, table] = written(document).slip!.blocks
    if (table?.kind !== 'table') throw new Error('the slip is no table')
    const wide: string[] = []
    const walk = (blocks: readonly DocxBlock[], room: number): void => {
      for (const block of blocks) {
        if (block.kind === 'table') for (const row of block.rows) for (const cell of row.cells) walk(cell.blocks, cell.width)
        else
          for (const run of block.runs)
            if (run.kind === 'text' && measured(run.text, run.props.bold ? 'bold' : 'normal', run.props.size!) > room - block.indent - block.indentRight + 1e-6)
              wide.push(run.text)
      }
    }
    for (const cell of table.rows[0]!.cells) walk(cell.blocks, cell.width)
    expect(wide).toEqual([])
    // The information's lines are held to SIX's sections, 52 mm in the receipt and 87 in the payment part, which are narrower than their cells.
    const lines = (cell: number, size: number): DocxParagraph[] =>
      table.rows[0]!.cells[cell]!.blocks.filter(
        (block): block is DocxParagraph =>
          block.kind === 'paragraph' && block.runs[0]?.kind === 'text' && block.runs[0].props.size === size && !block.runs[0].props.bold,
      )
    const widest = (cell: number, size: number): number =>
      Math.max(...lines(cell, size).map((line) => measured(line.runs.map((run) => (run.kind === 'text' ? run.text : '')).join(''), 'normal', size)))
    expect(widest(0, 8)).toBeLessThanOrEqual(mm(52) + 1e-6)
    expect(widest(2, 10)).toBeLessThanOrEqual(mm(87) + 1e-6)
  })

  // A line of an exact height shorter than the face's own cuts ink: at 10 pt the face's line is 11.17 pt, from the top of its tallest
  // accent to the foot of its deepest descender, and "Śląska" on a line of 11 pt would lose a hair of its Ś or its ą. So every line
  // is at least its face's ascender and descender at its size, by the font's own tables.
  test('sets every text on a line at least as tall as its face’s own, so that none of its ink is cut', () => {
    const { ascender, descender, unitsPerEm } = LIBERATION.normal
    const short: string[] = []
    const walk = (blocks: readonly DocxBlock[]): void => {
      for (const block of blocks) {
        if (block.kind === 'table') for (const row of block.rows) for (const cell of row.cells) walk(cell.blocks)
        else
          for (const run of block.runs)
            if (run.kind === 'text' && (block.line?.rule !== 'exact' || block.line.height < ((ascender - descender) / unitsPerEm) * run.props.size! - 1e-9))
              short.push(`${run.text} at ${run.props.size} pt on ${block.line?.height} pt`)
      }
    }
    walk(written(document).slip!.blocks)
    expect(short).toEqual([])
  })
})

describe('the slip’s page', () => {
  const bill = resolvedBill(BILL_EXAMPLES.one)
  const header = [paragraph('Letterhead')]
  const footer = [
    { kind: 'paragraph' as const, runs: [{ text: 'Page ' }, { field: 'pageNumber' as const }, { text: ' of ' }, { field: 'pageCount' as const }] },
  ]

  // A section with no header of its own prints the one before it: the report's header, of a height nobody measured, would push the slip
  // down its page, and its footer would print into the slip. So each is named, empty, wherever the report prints one.
  test('names an empty header and an empty footer of its own where the report prints them, and none where it does not', async () => {
    const regions = billDocument(bill, [paragraph('An invoice')], { pageHeader: header, pageFooter: footer })
    const file = written(regions)
    expect(await verifyDocx(fixtureOf('regions', regions), file)).toEqual([])
    expect(file.slip?.header?.blocks).toMatchObject([{ kind: 'paragraph', runs: [], line: { height: 1, rule: 'exact' } }])
    expect(file.slip?.footer?.blocks).toMatchObject([{ kind: 'paragraph', runs: [], line: { height: 1, rule: 'exact' } }])
    expect([file.slip?.header?.part, file.slip?.footer?.part]).toEqual(['word/header3.xml', 'word/footer2.xml'])
    expect([file.header?.part, file.footer?.part]).toEqual(['word/header1.xml', 'word/footer1.xml'])
    const bare = written(billDocument(bill))
    expect([bare.slip?.header, bare.slip?.footer]).toEqual([undefined, undefined])
    // A header alone: the footer is not named for the sake of the header.
    const headed = written(billDocument(bill, [], { pageHeader: header }))
    expect([headed.slip?.header?.part, headed.slip?.footer]).toEqual(['word/header3.xml', undefined])
  })

  // The count a footer prints is the file's pages, the slip's among them, as the PDF counts a slip that has a page to itself: a count of
  // the report's section alone would be a field no reader here was seen to work out.
  test("leaves the report's page count the file's pages, the slip's among them", () => {
    const file = written(billDocument(bill, [], { pageFooter: footer }))
    const fields = file.footer!.blocks.flatMap((block) =>
      block.kind === 'paragraph' ? block.runs.flatMap((run) => (run.kind === 'field' ? [run.field] : [])) : [],
    )
    expect(fields).toEqual(['PAGE', 'NUMPAGES'])
  })

  // The report's own page may be anything a QR-bill's report may be -- A4 upright, by the rule below both engines -- and its margins its
  // own: the slip's page is stated apart, so that a report's margin of 50 pt does not move the slip.
  test("is A4 upright with no margin at its sides and its foot, whatever the report's margins", () => {
    const { page, slip } = written(billDocument(bill))
    expect(page.margins).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
    expect(slip?.page).toMatchObject({ width: 595.3, height: 841.9, orientation: 'portrait', margins: { right: 0, bottom: 0, left: 0 }, header: 0, footer: 0 })
  })

  // The report's section is ended by the last paragraph it holds, and only a body of nothing is given one for it: a paragraph added
  // after a body's own last one is a line more on the report's last page, and on a page full to within a point a blank page before the slip.
  test.each([
    ['a body of nothing', [], ['']],
    [
      'a body that ends in a table',
      [{ kind: 'table' as const, id: 'lines', columns: [{ width: 'fill' as const, align: 'left' as const }], header: ['Key'], rows: [], emptyText: 'None' }],
      ['table', ''],
    ],
    ['a body that ends in a paragraph', [paragraph('Thank you')], ['Thank you']],
  ])("ends the report's section after %s with the last paragraph it holds, and adds none", async (_name, body, held) => {
    const document = billDocument(bill, body)
    const file = written(document)
    expect(await verifyDocx(fixtureOf('ending', document), file)).toEqual([])
    expect(file.body.map((block) => (block.kind === 'table' ? 'table' : block.runs.map((run) => (run.kind === 'text' ? run.text : '')).join('')))).toEqual(held)
    expect(file.body.at(-1)).toMatchObject({ kind: 'paragraph', endsSection: true })
    expect(file.body.filter((block) => block.kind === 'paragraph' && block.endsSection === true)).toHaveLength(1)
  })

  // The same document is the same bytes (0068): a slip's picture made twice, or its parts in another order, would be a file a host cannot compare.
  test('is the same bytes each time it is written', () => {
    const document = billDocument(bill, [], { pageHeader: header, pageFooter: footer })
    expect(renderDocx(document)).toEqual(renderDocx(document))
  })
})

describe('a slip is counted with the file it is a page of', () => {
  const bill = resolvedBill(BILL_EXAMPLES.three)
  const every = (blocks: readonly DocxBlock[]): number =>
    blocks.reduce(
      (sum, block) =>
        sum + (block.kind === 'paragraph' ? 1 : block.rows.reduce((cells, row) => cells + row.cells.reduce((held, cell) => held + every(cell.blocks), 0), 0)),
      0,
    )
  const spacers = (length: number): Block[] => Array.from({ length }, () => ({ kind: 'spacer', height: 1 }))

  // A slip is some hundred paragraphs with its blank fields' marks, and the bound is of the whole file (`limits.ts`): a slip that went
  // uncounted would be written past it. Counted from the file: every paragraph of its page, the one a body of nothing is given to
  // end the report's section, and the empty header's and footer's where the report prints its own.
  test('its paragraphs with the body’s: written at the bound, and refused one past it, naming the payment part', () => {
    const alone = written(billDocument(bill, []))
    const slip = every(alone.slip!.blocks)
    expect(slip).toBeGreaterThan(60)
    expect(every(alone.body)).toBe(1)
    // A body of spacers ends the section with its own last one.
    expect(() => renderDocx(billDocument(bill, spacers(MAX_DOCX_PARAGRAPHS - slip)))).not.toThrow()
    expect(refusalOf(billDocument(bill, spacers(MAX_DOCX_PARAGRAPHS - slip + 1)))).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
  }, 120_000)

  test('and the empty header and footer its page names, a paragraph each', () => {
    const regions = { pageHeader: [paragraph('Letterhead')], pageFooter: [paragraph('Footer')] }
    const file = written(billDocument(bill, [], regions))
    // The report's own two, the line a body of nothing is given, the slip's page, and its header's and its footer's.
    const held = 2 + 1 + every(file.slip!.blocks) + every(file.slip!.header!.blocks) + every(file.slip!.footer!.blocks)
    expect(every(file.slip!.header!.blocks) + every(file.slip!.footer!.blocks)).toBe(2)
    expect(() => renderDocx(billDocument(bill, spacers(MAX_DOCX_PARAGRAPHS - held + 1), regions))).not.toThrow()
    expect(refusalOf(billDocument(bill, spacers(MAX_DOCX_PARAGRAPHS - held + 2), regions))).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
  }, 120_000)
})

describe('verifyDocx sees a slip’s blank fields', () => {
  const document = billDocument(resolvedBill(BILL_EXAMPLES.three))
  /** The tables of a file's slip that are a blank field's marks, however deep: three rows of cells that hold nothing. */
  const fields = (blocks: readonly DocxBlock[]): DocxTable[] =>
    blocks.flatMap((block) =>
      block.kind === 'paragraph'
        ? []
        : block.rows.length === 3 &&
            block.rows.every((row) => row.cells.every((cell) => cell.blocks.every((each) => each.kind === 'paragraph' && each.runs.length === 0)))
          ? [block]
          : block.rows.flatMap((row) => row.cells.flatMap((cell) => fields(cell.blocks))),
    )

  // The corpus's own file of a slip, written by hand, leaves nothing blank: what its check says of a blank field's marks is shown here, on
  // the writer's file read back, with one thing of a field changed in what was read. A check that never failed on a mark has not been shown to see one.
  test.each<[string, (field: DocxTable) => void, RegExp]>([
    [
      'a mark heavier than 0.75 pt',
      (field) => void ((field.rows[0]!.cells.at(-1)!.borders.top as { weight: number }).weight = 1.5),
      /a blank field of the slip is not four corner marks of 3 mm arms and 0\.75 pt/,
    ],
    [
      'a mark with a third arm',
      (field) => void ((field.rows[0]!.cells.at(-1)!.borders as { left?: unknown }).left = { weight: 0.75, color: '#000000' }),
      /not four corner marks/,
    ],
    [
      'a field a millimetre lower than its marks say',
      (field) => void ((field.rows[1]!.height as { value: number }).value += 2.83),
      /has no blank field \d+ by \d+ mm where SIX puts it/,
    ],
  ])('%s', async (_name, change, problem) => {
    const file = written(document)
    const found = fields(file.slip!.blocks)
    // The debtor's field in each part, and the amount's in each: four fields of four marks.
    expect(found).toHaveLength(4)
    expect(await verifyDocx(fixtureOf('blank', document), file)).toEqual([])
    change(found[0]!)
    expect((await verifyDocx(fixtureOf('blank', document), file)).join('\n')).toMatch(problem)
  })
})

describe('verifyDocx holds the face’s other name', () => {
  // The other name is what a reader without Arial finds the face of the slip's widths by. A report that maps fonts of its own has a
  // slip in Arial all the same: a check that looked for the name only where the report maps none would pass such a file without it.
  test('in a report that maps a font of its own, as in one that maps none', async () => {
    const document = billDocument(resolvedBill(BILL_EXAMPLES.one), [], { fonts: { serif: { normal: LONGEST_FAMILY } } })
    const file = written(document)
    expect(await verifyDocx(fixtureOf('mapped', document), file)).toEqual([])
    const arial = file.fonts.find((font) => font.name === 'Arial')
    expect(arial).toMatchObject({ altName: 'Liberation Sans', family: 'swiss' })
    delete (arial as { altName?: string }).altName
    expect((await verifyDocx(fixtureOf('mapped', document), file)).join('\n')).toMatch(/the font table does not give Liberation Sans as Arial's other name/)
  })
})

describe('the Swiss QR Code', () => {
  // The code as a scanner reads it from the paper, with the white the slip leaves around it: its payload byte for byte, at SIX's level, never
  // mirrored or turned, which the reader refuses. A picture too coarse is one a reader smooths as it scales it to 46 mm.
  test.each(BILLS)('of %s scans to its payload, at level M, from a picture fine enough for 46 mm', async (_name, bill) => {
    const resolved = resolvedBill(bill)
    const code = await readSlipCode(written(billDocument(resolved)))
    expect(code?.read?.text).toBe(resolved.payload)
    expect(code?.read?.bytes).toEqual(new TextEncoder().encode(resolved.payload))
    expect(code?.read).toMatchObject({ ecLevel: 'M', version: code?.version })
    expect(code?.picture.width).toBeCloseTo(mm(46), 3)
    expect(code?.picture.height).toBeCloseTo(mm(46), 3)
    // 600 pixels to the inch at the least, and whole pixels a module.
    expect((code!.side * 72) / code!.picture.width).toBeGreaterThanOrEqual(600)
    expect(code!.side % (17 + 4 * code!.version)).toBe(0)
  })

  // The cross is SIX's mark of a Swiss QR Code (IG 6.4.2), drawn into the picture: found in its pixels, where SIX's millimetres put each part.
  test('holds the Swiss cross in its pixels: a white square of 7 mm, a black one of 6 mm, and the white cross on it', async () => {
    const code = (await readSlipCode(written(billDocument(resolvedBill(BILL_EXAMPLES.two)))))!
    const { pixels, side } = code
    const at = (across: number, down: number): number => pixels.data[Math.floor(((down + 23) * side) / 46) * side + Math.floor(((across + 23) * side) / 46)]!
    const [WHITE, BLACK] = [255, 0]
    // The cross: its centre, and along each arm, 35/9 mm from end to end and 7/6 mm wide.
    for (const [x, y] of [
      [0, 0],
      [1.9, 0],
      [-1.9, 0],
      [0, 1.9],
      [0, -1.9],
      [1.9, 0.55],
      [0.55, -1.9],
    ] as const)
      expect(at(x, y), `${x}, ${y}`).toBe(WHITE)
    // The black square around it: past an arm's end, beside an arm, and in each corner, up to 3 mm from the centre.
    for (const [x, y] of [
      [2.0, 0],
      [0, -2.0],
      [0.62, 1],
      [1, -0.62],
      [2.9, 2.9],
      [-2.9, 2.9],
      [2.9, -2.9],
      [-2.9, -2.9],
    ] as const)
      expect(at(x, y), `${x}, ${y}`).toBe(BLACK)
    // The white square it stands on, from 3 mm to 3.5 mm on every side.
    for (const [x, y] of [
      [3.25, 0],
      [-3.25, 0],
      [0, 3.25],
      [0, -3.25],
      [3.4, 3.4],
      [-3.4, -3.4],
    ] as const)
      expect(at(x, y), `${x}, ${y}`).toBe(WHITE)
    // And of the 7 mm about the centre, as much black as the square less the cross is: 36 mm² less 7.71, of 49.
    let black = 0
    const [from, to] = [Math.floor((19.5 * side) / 46), Math.ceil((26.5 * side) / 46)]
    for (let y = from; y < to; y++) for (let x = from; x < to; x++) if (pixels.data[y * side + x] === BLACK) black++
    // To a hundredth: an edge stands within half a pixel of SIX's, and the square's and the cross's edges are some 40 mm long together.
    expect(Math.abs(black / ((7 * side) / 46) ** 2 - (36 - (2 * (7 / 6) * (35 / 9) - (7 / 6) ** 2)) / 49)).toBeLessThan(0.01)
  })
})

describe('a value is broken into lines by the widths of the face', () => {
  const WIDTH = mm(52)
  // Each line as full as it can be, the space at a break no character of either line: a line a word too long is one Word breaks itself.
  test('at a space, each line as full as its section lets it be', () => {
    const lines = broken('Société coopérative des artisans réunis du Jura bernois et environs', 8, WIDTH)
    expect(lines).toEqual(['Société coopérative des artisans réunis', 'du Jura bernois et environs'])
    for (const line of lines) expect(measured(line, 'normal', 8)).toBeLessThanOrEqual(WIDTH)
    // The first line would not hold the next word.
    expect(measured(`${lines[0]} du`, 'normal', 8)).toBeGreaterThan(WIDTH)
    // Nothing of the value is lost: its words, in order.
    expect(lines.join(' ')).toBe('Société coopérative des artisans réunis du Jura bernois et environs')
  })

  // A word with no space in it, as billing information is: left whole it would be a line wider than its cell, which Word breaks where it will.
  test('inside a word only where the word alone is wider than a line, at the last character that fits', () => {
    const billing = '//S1/10/10201409/11/190512/20/1400.000-53/30/106017086/31/180508/32/7.7/40/2:10;0:30'
    const lines = broken(billing, 8, WIDTH)
    expect(lines.join('')).toBe(billing)
    expect(lines.length).toBeGreaterThan(1)
    for (const [index, line] of lines.entries()) {
      expect(measured(line, 'normal', 8)).toBeLessThanOrEqual(WIDTH)
      // Every line but the last is full: one character more of the value would pass the width.
      if (index < lines.length - 1) expect(measured(line + lines[index + 1]![0], 'normal', 8)).toBeGreaterThan(WIDTH)
    }
    // A long word after a short one starts a line of its own, and what is left of it shares its last line with the next word.
    expect(broken(`A ${'W'.repeat(30)} B`, 8, WIDTH)).toEqual(['A', 'W'.repeat(19), `${'W'.repeat(11)} B`])
  })

  // The PDF's engine breaks a name after its hyphen, by Unicode's rules: broken at spaces alone, the receipt's lines of such a name are
  // not the PDF's, and a section may be a line taller. A hyphen before a digit is a minus or a range, and holds its number.
  test('after a hyphen that no digit follows, the hyphen ending its line', () => {
    expect(broken('Hoirie de feu Jean-François Übersax-Çelik, par Maître Anaïs Šimůnek', 8, WIDTH)).toEqual([
      'Hoirie de feu Jean-François Übersax-',
      'Çelik, par Maître Anaïs Šimůnek',
    ])
    const numbered = broken(`${'W'.repeat(17)} 1400.000-53`, 8, WIDTH)
    expect(numbered).toEqual(['W'.repeat(17), '1400.000-53'])
  })

  // Two spaces in a value are its own, kept where they stand in a line; at a break they are the break, both of them: a line that
  // began with the second would stand a space in from the lines above it.
  test('at a run of spaces as at one, no line beginning or ending with a space', () => {
    const lines = broken(`${'W'.repeat(17)}  ${'W'.repeat(17)}  W`, 8, WIDTH)
    expect(lines).toEqual(['W'.repeat(17), `${'W'.repeat(17)}  W`])
  })

  test('not at all where it fits, and a value of nothing is one line of nothing', () => {
    expect(broken('8000 Seldwyla', 8, WIDTH)).toEqual(['8000 Seldwyla'])
    expect(broken('', 8, WIDTH)).toEqual([''])
  })
})

describe('a bill is refused, whole, where its slip cannot be written as SIX lays it out', () => {
  const GOOD = resolvedBill(BILL_EXAMPLES.one)
  const refused = (bill: Partial<QrBill>, more = {}): ReturnType<typeof refusalOf> => refusalOf(billDocument({ ...GOOD, ...bill }, [], more))

  // The widths the lines are shown to fit by are of SIX's characters alone: a character outside them has none, and a line of unknown
  // width is one nothing shows to fit. Greek is one a report prints, and the PDF's face draws.
  test('a character with no width here, naming it and never the value', () => {
    const refusal = refused({ creditor: ['Ωmega AG', '8000 Seldwyla'] })
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'paymentPart' })
    expect(refusal.message).toMatch(/^the payment part's creditor's address prints U\+03A9, which is none of the characters SIX allows a bill/)
    expect(refusal.message).not.toMatch(/mega|Seldwyla/)
  })

  // Lines of 140 characters, which SIX's rules never give an address: the information of either part is then taller than its section, and
  // would run into the amount or off the paper. The payment part's is measured first, as the PDF renderer measures it, and in its words.
  test('information taller than its section, the payment part first and then the receipt, in the PDF renderer’s words', () => {
    const long = Array.from({ length: 3 }, () => 'Muster '.repeat(20).trim())
    expect(refused({ creditor: long, debtor: long })).toMatchObject({
      code: 'content-too-large',
      subject: 'paymentPart',
      message: "the payment part's information is taller than its section: SIX gives it 85 mm (240.94 pt)",
    })
    // What the payment part's 87 mm hold and the receipt's 52 do not.
    const medium = Array.from({ length: 3 }, () => 'Muster '.repeat(11).trim())
    expect(refused({ creditor: medium })).toMatchObject({
      code: 'content-too-large',
      message: "the receipt's information is taller than its section: SIX gives it 56 mm (158.74 pt)",
    })
  })

  // A heading, a currency or an amount stands on one line at SIX's place: one wider than its place is one Word breaks, and never one the
  // writer sets smaller. SIX's own headings fit, in every language (the cases above); a document made by hand may hold any.
  test.each([
    [
      'a title',
      { headings: { ...GOOD.headings, receipt: 'Empfangsschein '.repeat(4) } },
      /heading 'receipt' is \d+\.\d\d pt wide at 11 pt, on one line; its place on the slip is 147\.40 pt wide/,
    ],
    ['the heading over the amount', { headings: { ...GOOD.headings, amount: 'Betrag in Schweizer Franken und Rappen' } }, /heading 'amount' in the receipt is/],
    [
      'the instruction to separate',
      { headings: { ...GOOD.headings, separate: 'W'.repeat(80) } },
      /heading 'separate' is .* its place on the slip is 595\.28 pt wide/,
    ],
    [
      'a heading of the information',
      { headings: { ...GOOD.headings, account: 'Konto / Zahlbar an '.repeat(4) } },
      /heading over the payment part's information is/,
    ],
  ])('%s wider than its place', (_name, bill, sentence) => {
    const refusal = refused(bill)
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
    expect(refusal.message).toMatch(sentence)
  })

  // The longest values SIX allows fit, every one: a bill the runtime resolved is not refused for a line.
  test('and not a bill whose every value is as long as SIX allows', () => {
    expect(() => renderDocx(billDocument(resolvedBill(LONG_BILL)))).not.toThrow()
  })

  // An address line of nothing, which no runtime resolves: its line is white, since a run of nothing is no run of a file the reader takes.
  test('and not a value of nothing, which is a line of nothing', () => {
    const file = written(billDocument({ ...GOOD, creditor: ['', '8000 Seldwyla'] }))
    expect(file.slip).toBeDefined()
  })

  // The plan is what holds every height: a slip that was not planned -- lines the planner would have refused -- is no file with its
  // sections out of place, but an error, since nothing of the writer's own may be written past where SIX puts the next section.
  test('and a slip nobody planned is an error, never a slip with a section lower than SIX puts it', () => {
    const planned = planSlip(GOOD, documentOf([]).page)
    const lines = Array.from({ length: 40 }, () => 'Muster')
    const picture = { id: 1, width: 130, height: 130, embed: 'rId1' as const }
    expect(() => slipNodes({ ...planned, receipt: [{ heading: 'Konto', lines }] }, picture)).toThrow(
      /a slip's cell is \d+ twentieths of a point past where its next section starts/,
    )
    expect(() => slipNodes(planned, picture)).not.toThrow()
  })

  // A bill is looked at once every block is right, and before nothing is written: a refused bill leaves no file.
  test('after a block no engine prints, which is refused first', () => {
    const red = paragraph('red', { color: 'red' })
    expect(refusalOf(documentOf([red], { paymentPart: { ...GOOD, currency: 'USD' } as unknown as QrBill })).subject).toBe('body[0]')
  })
})
