import { COPY_LABEL_INSET, copyWords } from './check-docx-copy.js'
import { readPictureCode } from './code-picture.js'
import type { PixelCode } from './codes.js'
import type { ResolvedDocument } from './document.js'
import type { Docx, DocxBlock, DocxBorder, DocxParagraph, DocxPicture, DocxTable } from './docx/model.js'
import { readPng, type GreyPixels } from './docx/png.js'

/**
 * A QR-bill's slip held to what a Word file states for it (0075,
 * extending 0068 and 0003), by the corpus's own reading of that record
 * and of SIX's documents, never the writer's code: the slip's page, the
 * file's last section, whose header is empty, or the label alone where
 * the document is a copy of an e-invoice (0077); its instruction, its lines and its three cells;
 * every heading and value where SIX puts it, at its size and weight; the
 * blank fields' corner marks; and the Swiss QR Code's picture, on its own
 * pixels and on what ZXing reads in them.
 *
 * Every number is SIX's, written out from the source: "IG" is the Swiss
 * Implementation Guidelines for the QR-bill, version 2.4, and "SG" its
 * Style Guide, version 1.1, whose page 6 gives each section's place in
 * millimetres, page 7 the blank fields' and page 15 the sizes and the
 * line spacing. A place is worked out from what the file states alone:
 * a line's top is the sum of the exact heights above it in its cell, and
 * its baseline the face's ascender below that, as the PDF draws it.
 *
 * What it cannot show is what Word then prints: that the slip stands at
 * the page's foot, that no line is broken, or that a phone reads the
 * code from the paper. Nor that a line fits its place: the corpus holds
 * no face's widths, and the writer's own tests hold that.
 */

type QrBill = NonNullable<ResolvedDocument['paymentPart']>

const mm = (value: number): number => (value * 72) / 25.4

/** A place read back from Word's units, each a twentieth of a point, is SIX's to within a few of them summed. */
const NEAR = 0.06
const near = (read: number, stated: number, within = NEAR): boolean => Math.abs(read - stated) <= within

const BLACK = '#000000'
/** The family the slip is named in, one of the four SIX admits (IG 3.4), and the face of its widths the font table names beside it. */
const FAMILY = 'Arial'
const OTHER_FAMILY = 'Liberation Sans'
/** How far below a line's top its baseline stands, in ems: Liberation Sans's ascender, 1854 of its 2048 units, which Arial's is. */
const ASCENDER = 1854 / 2048

/** A4 upright, and the slip across its foot: 210 by 105 mm, the receipt 62 mm wide (IG 3.1, 3.3). */
const PAPER = { width: 595.28, height: 841.89 }
const SLIP = { top: PAPER.height - mm(105), receipt: mm(62), information: mm(118) }

/** A part's lettering (SG 15) and its sections (SG 6, 7), from the slip's top left. */
interface Part {
  readonly name: string
  readonly heading: number
  readonly value: number
  readonly pitch: number
  /** The amount's line under its heading's (SG 15). */
  readonly amountPitch: number
  readonly title: { readonly x: number; readonly top: number }
  readonly information: { readonly x: number; readonly top: number; readonly bottom: number }
  readonly amount: { readonly x: number; readonly top: number; readonly indent: number; readonly bottom: number }
  readonly amountField: { readonly x: number; readonly width: number; readonly height: number; readonly onAmountLine: boolean }
  readonly debtorField: { readonly width: number; readonly height: number }
}

const RECEIPT: Part = {
  name: 'the receipt',
  heading: 6,
  value: 8,
  pitch: 9,
  amountPitch: 11,
  title: { x: mm(5), top: mm(5) },
  information: { x: mm(5), top: mm(12), bottom: mm(68) },
  amount: { x: mm(5), top: mm(68), indent: mm(12), bottom: mm(82) },
  amountField: { x: mm(27), width: mm(30), height: mm(10), onAmountLine: false },
  debtorField: { width: mm(52), height: mm(20) },
}

const PAYMENT: Part = {
  name: 'the payment part',
  heading: 8,
  value: 10,
  pitch: 11,
  amountPitch: 13,
  title: { x: mm(67), top: mm(5) },
  information: { x: mm(118), top: mm(5), bottom: mm(90) },
  amount: { x: mm(67), top: mm(68), indent: mm(15), bottom: mm(90) },
  amountField: { x: mm(78), width: mm(40), height: mm(15), onAmountLine: true },
  debtorField: { width: mm(65), height: mm(25) },
}

/** A line of the slip where the file's own heights put it: its left edge, or its right where it is set to the right, and its top, from the slip's top left. */
interface Line {
  readonly x: number
  readonly right: number
  readonly top: number
  readonly text: string
  readonly size: number | undefined
  readonly bold: boolean
  readonly paragraph: DocxParagraph
  taken: boolean
}

/** A blank field: the box its four corner marks stand at the corners of. */
interface Field {
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface Found {
  readonly lines: Line[]
  readonly fields: Field[]
  readonly pictures: { readonly x: number; readonly top: number; readonly paragraph: DocxParagraph }[]
  readonly problems: string[]
}

const isEmpty = (block: DocxBlock): boolean => block.kind === 'paragraph' && block.runs.length === 0

/** Whether a table is a blank field's corner marks: three rows of cells that hold nothing. */
const marks = (table: DocxTable): boolean => table.rows.length === 3 && table.rows.every((row) => row.cells.every((cell) => cell.blocks.every(isEmpty)))

/** `blocks` placed from `x`, `top` in a cell `width` wide: every line, field and picture found, and how tall the blocks are together. */
function place(blocks: readonly DocxBlock[], x: number, top: number, width: number, found: Found): number {
  let down = top
  for (const block of blocks) {
    if (block.kind === 'table') {
      down += placeTable(block, x, down, found)
      continue
    }
    const picture = block.runs.find((run) => run.kind === 'picture')
    if (block.before !== 0 || block.after !== 0) found.problems.push('a paragraph of the slip has space before or after it, which no line above it states')
    if (picture?.kind === 'picture') {
      found.pictures.push({ x: x + block.indent, top: down, paragraph: block })
      down += picture.picture.height
      continue
    }
    if (block.line?.rule !== 'exact') {
      found.problems.push('a paragraph of the slip is on no line of an exact height, so what stands under it stands where Word puts it')
      continue
    }
    const [run, ...more] = block.runs
    if (run !== undefined) {
      if (run.kind !== 'text' || more.length > 0) found.problems.push('a paragraph of the slip holds something other than one run of text')
      else {
        const { props } = run
        if (props.family !== FAMILY || props.color !== BLACK || props.italic || props.shift !== undefined)
          found.problems.push(`'${run.text}' is not set in ${FAMILY}, black and upright on its line`)
        if (run.text.includes('\n')) found.problems.push(`'${run.text}' holds a line break, where each line of the slip is a paragraph`)
        found.lines.push({
          x: x + block.indent,
          right: x + width - block.indentRight,
          top: down,
          text: run.text,
          size: props.size,
          bold: props.bold,
          paragraph: block,
          taken: false,
        })
      }
    }
    down += block.line.height
  }
  return down - top
}

function placeTable(table: DocxTable, x: number, top: number, found: Found): number {
  if (Object.keys(table.borders).length > 0 || (['top', 'left', 'bottom', 'right'] as const).some((side) => table.margins?.[side] !== 0))
    found.problems.push('a table of the slip has rules of its own, or pads its cells')
  let down = top
  const field = marks(table)
  for (const row of table.rows) {
    let across = x
    let content = 0
    for (const cell of row.cells) {
      content = Math.max(content, place(cell.blocks, across, down, cell.width, found))
      across += cell.width
    }
    // A row of an exact height cuts what does not fit it: only the rows of a blank field's marks, which hold nothing, are exact.
    if (row.height?.rule === 'exact' && !field)
      found.problems.push('a row of the slip that holds text is exactly its height, which cuts a line that does not fit it')
    down += row.height === undefined ? content : row.height.rule === 'exact' ? row.height.value : Math.max(row.height.value, content)
  }
  if (field) found.fields.push(fieldOf(table, x, top, found))
  return down - top
}

/** A blank field's box, its marks held to SIX's: 3 mm arms, 0.75 pt, at its four corners and nowhere else (IG 3.5.3, SG 7). */
function fieldOf(table: DocxTable, x: number, top: number, found: Found): Field {
  const inset = table.grid.length === 4 ? table.grid[0]! : 0
  const columns = table.grid.slice(-3)
  const rows = table.rows.map((row) => row.height?.value ?? Number.NaN)
  const mark: DocxBorder = { weight: 0.75, color: BLACK }
  const same = (read: DocxBorder | undefined): boolean => read !== undefined && near(read.weight, mark.weight) && read.color === mark.color
  const cornered = table.rows.every((row, down) => {
    const cells = row.cells.slice(-3)
    return cells.every((cell, across) => {
      const sides = Object.keys(cell.borders).sort().join()
      if (down === 1 || across === 1) return sides === ''
      const wanted = [down === 0 ? 'top' : 'bottom', across === 0 ? 'left' : 'right'] as const
      return sides === [...wanted].sort().join() && wanted.every((side) => same(cell.borders[side]))
    })
  })
  const armed = near(columns[0]!, mm(3)) && near(columns[2]!, mm(3)) && near(rows[0]!, mm(3)) && near(rows[2]!, mm(3))
  if (
    !cornered ||
    !armed ||
    table.rows.some((row) => row.height?.rule !== 'exact' || row.cells.slice(0, -3).some((cell) => Object.keys(cell.borders).length > 0))
  )
    found.problems.push('a blank field of the slip is not four corner marks of 3 mm arms and 0.75 pt')
  return { x: x + inset, top, width: columns.reduce((sum, each) => sum + each, 0), height: rows.reduce((sum, each) => sum + each, 0) }
}

const squeezed = (text: string): string => text.replaceAll(' ', '')

/** What the slip of `document`'s bill is held to in `docx`, and the Swiss QR Code's pixels for what a scanner reads in them. */
export function verifySlip(
  document: ResolvedDocument,
  docx: Docx,
): { readonly problems: string[]; readonly code?: { readonly png: GreyPixels; readonly version: number } } {
  const bill = document.paymentPart
  const { slip } = docx
  if (bill === undefined) return { problems: slip === undefined ? [] : ['the file has a second section, and the document no payment part'] }
  if (slip === undefined) return { problems: ['the document is paid by a QR-bill, and the file has no page for its slip'] }
  const problems: string[] = []
  const say = (problem: string): void => void problems.push(`the slip: ${problem}`)

  // The page: A4 upright whatever the report's, nothing at its sides and its foot, and no header or footer of the report's.
  const { page } = slip
  if (!near(page.width, PAPER.width) || !near(page.height, PAPER.height) || page.orientation !== 'portrait') say('its page is not A4 upright')
  if (page.margins.left !== 0 || page.margins.right !== 0 || page.margins.bottom !== 0)
    say('its page has a margin at a side or at its foot, where the slip spans the paper and ends at its foot')
  // A copy of an e-invoice says so on this page too (0077): its header is the label alone, 5 mm down, which `check-docx-copy.ts` holds.
  const labelled = copyWords(document) !== undefined
  if (page.titlePage || page.footer !== 0 || (labelled ? !near(page.header, COPY_LABEL_INSET) : page.header !== 0))
    say(
      labelled
        ? "its page has a header of its first page's own, or one that does not stand 5 mm down, where a copy's label stands"
        : "its page has a header of its first page's own, or one that stands in from the paper's edge",
    )
  for (const [kind, own, report] of [
    ['header', slip.header, docx.header],
    ['footer', slip.footer, docx.footer],
  ] as const) {
    if (kind === 'header' && labelled) continue
    const empty = own !== undefined && own.blocks.length === 1 && isEmpty(own.blocks[0]!)
    if (report !== undefined && (!empty || own.part === report.part)) say(`its page prints the report's page ${kind}, or one that is not empty`)
    if (report === undefined && own !== undefined) say(`its page names a ${kind} where the report prints none`)
  }

  const [instruction, table, closing, ...more] = slip.blocks
  if (instruction?.kind !== 'paragraph' || table?.kind !== 'table' || closing === undefined || !isEmpty(closing) || more.length > 0) {
    say('its page is not the instruction to separate, the slip and an empty paragraph')
    return { problems }
  }
  // The instruction above the line across, outside the payment part (IG 3.7): its line ends where the slip begins, 192 mm down the page.
  const above = instruction.runs[0]
  if (above?.kind !== 'text' || instruction.runs.length !== 1 || above.text !== bill.headings.separate)
    say("its first line is not the bill's instruction to separate")
  else if (above.props.size !== 8 || above.props.bold || above.props.family !== FAMILY || instruction.align !== 'center')
    say('its instruction is not 8 pt, regular and centred')
  if (instruction.line?.rule !== 'exact' || !near(page.margins.top + (instruction.line?.height ?? 0), SLIP.top))
    say(`its top is ${page.margins.top + (instruction.line?.height ?? 0)} pt down the page, where SIX puts it ${SLIP.top.toFixed(2)}`)

  // The slip: one row of three cells, the receipt, the payment part's left and its information, cut along its top and between the first two.
  const [row, ...rows] = table.rows
  const cells = row?.cells ?? []
  const widths = [SLIP.receipt, SLIP.information - SLIP.receipt, PAPER.width - SLIP.information]
  if (row === undefined || rows.length > 0 || cells.length !== 3 || !cells.every((cell, index) => near(cell.width, widths[index]!))) {
    say('it is not one row of three cells, 62, 56 and 92 mm wide')
    return { problems }
  }
  if (row.height?.rule !== 'atLeast' || row.height.value > mm(105) || row.height.value < mm(100))
    say('its row is not at least 100 mm tall and at most 105, or is exactly its height')
  const cut = (read: DocxBorder | undefined): boolean => read !== undefined && near(read.weight, 0.5) && read.color === BLACK
  const sides = cells.map((cell) => Object.keys(cell.borders).sort().join())
  if (sides.join(';') !== 'right,top;top;top' || !cells.every((cell) => cut(cell.borders.top)) || !cut(cells[0]!.borders.right))
    say('it is not cut along its top and between the receipt and the payment part by a line of half a point, and by no other')

  const found: Found = { lines: [], fields: [], pictures: [], problems: [] }
  let across = 0
  for (const cell of cells) {
    const tall = place(cell.blocks, across, 0, cell.width, found)
    if (tall > mm(105) + NEAR) say('a cell of it is taller than the slip')
    across += cell.width
  }
  found.problems.forEach(say)

  /** The line that prints `text` at `x`, `top`, at `size` and in its weight; said where it is missing. */
  const line = (what: string, text: string, x: number, top: number, size: number, bold: boolean): Line | undefined => {
    const at = found.lines.find(
      (each) => !each.taken && each.text === text && near(each.x, x) && near(each.top, top) && each.size === size && each.bold === bold,
    )
    if (at === undefined)
      say(`${what} is not printed ${(x / mm(1)).toFixed(1)} mm in and ${(top / mm(1)).toFixed(1)} mm down, at ${size} pt${bold ? ' bold' : ''}`)
    else at.taken = true
    return at
  }
  const field = (what: string, box: Field): void => {
    const at = found.fields.findIndex((each) => near(each.x, box.x) && near(each.top, box.top) && near(each.width, box.width) && near(each.height, box.height))
    if (at < 0) say(`${what} has no blank field ${(box.width / mm(1)).toFixed(0)} by ${(box.height / mm(1)).toFixed(0)} mm where SIX puts it`)
    else found.fields.splice(at, 1)
  }

  const { headings } = bill
  for (const part of [RECEIPT, PAYMENT]) {
    line(`${part.name}'s title`, part === RECEIPT ? headings.receipt : headings.paymentPart, part.title.x, part.title.top, 11, true)
    informationProblems(bill, part, found, line, field, say)
    // The amount section (SG 6, 7): the headings on one line, the currency and the amount a pitch under them, or the blank field.
    const { amount } = part
    line(`${part.name}'s heading over the currency`, headings.currency, amount.x, amount.top, part.heading, true)
    line(`${part.name}'s heading over the amount`, headings.amount, amount.x + amount.indent, amount.top, part.heading, true)
    const under = amount.top + ASCENDER * part.heading + part.amountPitch - ASCENDER * part.value
    line(`${part.name}'s currency`, bill.currency, amount.x, under, part.value, false)
    if (bill.amount !== null) line(`${part.name}'s amount`, bill.amount, amount.x + amount.indent, under, part.value, false)
    else field(`${part.name}'s amount`, { ...part.amountField, top: part.amountField.onAmountLine ? under : amount.top })
  }
  // The acceptance point, set to the right at the receipt's right margin, at its section's top (IG 3.6.4, SG 6).
  const acceptance = found.lines.find((each) => !each.taken && each.text === headings.acceptancePoint && near(each.top, mm(82)))
  if (acceptance === undefined || acceptance.paragraph.align !== 'right' || !near(acceptance.right, mm(57)) || acceptance.size !== 6 || !acceptance.bold)
    say('the acceptance point is not printed 82 mm down, 6 pt bold, set to the right 57 mm in')
  else acceptance.taken = true

  for (const loose of found.lines.filter((each) => !each.taken)) say(`'${loose.text}' is a line no part of the bill prints there`)
  if (found.fields.length > 0) say(`it has ${found.fields.length} blank fields more than the bill leaves blank`)

  const listed = docx.fonts.find((font) => font.name === FAMILY)
  if (listed === undefined || listed.family !== 'swiss') say(`the font table does not list ${FAMILY} as a swiss face`)
  else if (listed.altName !== OTHER_FAMILY && !document.fonts) say(`the font table does not give ${OTHER_FAMILY} as ${FAMILY}'s other name`)

  const code = codeProblems(found, say)
  return { problems, ...(code === undefined ? {} : { code }) }
}

/** A part's information (IG 3.5.4, 3.6.2, SG 15): each heading over its values, every baseline a pitch under the one before and a blank line between two blocks, inside its section. */
function informationProblems(
  bill: QrBill,
  part: Part,
  found: Found,
  line: (what: string, text: string, x: number, top: number, size: number, bold: boolean) => Line | undefined,
  field: (what: string, box: Field) => void,
  say: (problem: string) => void,
): void {
  const { headings } = bill
  const { x, top, bottom } = part.information
  const blocks: { heading: string; values?: readonly string[] }[] = [
    { heading: headings.account, values: [bill.account, ...bill.creditor] },
    ...(bill.reference === null ? [] : [{ heading: headings.reference, values: [bill.reference] }]),
    ...(part === PAYMENT && bill.additionalInformation.length > 0 ? [{ heading: headings.additionalInformation, values: bill.additionalInformation }] : []),
    bill.debtor === null ? { heading: headings.payableBy } : { heading: headings.payableBy, values: bill.debtor },
  ]
  const shift = ASCENDER * (part.value - part.heading)
  // Where the next heading's line starts: the section's top, then a blank line under the last line of the block before.
  let next = top
  for (const block of blocks) {
    const what = `${part.name}'s '${block.heading}'`
    line(`${what}, a heading,`, block.heading, x, next, part.heading, true)
    // A value's baseline is a pitch under its heading's: its line starts that much lower less what its ascender is longer.
    let down = next + part.pitch - shift
    if (block.values === undefined) {
      const box = { x, top: down + 2, ...part.debtorField }
      field(what, box)
      if (box.top + box.height > bottom + NEAR) say(`${what}'s blank field ends below its section`)
      continue
    }
    const wanted = squeezed(block.values.join(''))
    let read = ''
    while (read.length < wanted.length) {
      const at = found.lines.find((each) => !each.taken && near(each.x, x) && near(each.top, down) && each.size === part.value && !each.bold)
      if (at === undefined) break
      at.taken = true
      read += squeezed(at.text)
      down += part.pitch
    }
    if (read !== wanted) say(`${what} does not print its values, line under line a pitch of ${part.pitch} pt apart`)
    if (down > bottom + NEAR) say(`${what} ends ${(down - bottom).toFixed(2)} pt below its section`)
    // The blank line: the next heading's baseline two pitches under the last value's.
    next = down + part.pitch + shift
  }
}

/** The Swiss QR Code's picture (IG 3.5.2, 6.4): 46 mm a side, 67 mm in and 17 mm down, a PNG of whole pixels a module with the Swiss cross over its centre. */
function codeProblems(found: Found, say: (problem: string) => void): { readonly png: GreyPixels; readonly version: number } | undefined {
  const [placed, ...more] = found.pictures
  const run = placed?.paragraph.runs[0]
  if (placed === undefined || more.length > 0 || run?.kind !== 'picture' || placed.paragraph.runs.length !== 1) {
    say('it does not hold one picture, its Swiss QR Code, alone in its paragraph')
    return undefined
  }
  const { picture } = run
  if (!near(picture.width, mm(46), 0.01) || !near(picture.height, mm(46), 0.01))
    say(`its code is ${picture.width} × ${picture.height} pt, where SIX prints it 46 mm a side`)
  if (!near(placed.x, mm(67)) || !near(placed.top, mm(17))) say('its code does not stand 67 mm in and 17 mm down')
  if (picture.part.contentType !== 'image/png' || picture.svg !== undefined || picture.crop !== undefined) say('its code is not a PNG drawn whole')
  try {
    const png = readPng(picture.part.bytes)
    const version = swissVersion(png)
    if (png.width * 72 < 600 * picture.width - 1e-6 && png.width + (17 + 4 * version) <= 2400)
      say(`its code is ${png.width} pixels across 46 mm, fewer than 600 to the inch`)
    return { png, version }
  } catch (error) {
    say(`its code: ${(error as Error).message}`)
    return undefined
  }
}

/** Points of the Swiss cross (IG 6.4.2) in millimetres from the code's centre, and what stands there: the white cross, the black square it is on, the white square around that. */
const CROSS_POINTS: readonly (readonly [number, number, 'white' | 'black'])[] = [
  [0, 0, 'white'],
  [1.5, 0, 'white'],
  [0, 1.5, 'white'],
  [2.5, 0, 'black'],
  [0, 2.5, 'black'],
  [1.2, 1.2, 'black'],
  [2.5, 2.5, 'black'],
  [3.25, 0, 'white'],
  [0, 3.25, 'white'],
  [3.25, 3.25, 'white'],
]

/**
 * The version of the symbol `png` is a picture of, a Swiss QR Code's: a
 * square of whole pixels a module from its very corner, with no quiet
 * zone, every pixel the colour of its module but in the 7 mm about its
 * centre, where the Swiss cross stands. Throws, saying why, where it is
 * anything else.
 */
export function swissVersion(png: GreyPixels): number {
  const { width, height, data } = png
  if (width !== height) throw new Error(`the picture is ${width} by ${height} pixels, and a code's is square`)
  let run = 0
  while (run < width && data[run] === 0) run++
  const pixels = run / 7
  if (run === 0 || !Number.isInteger(pixels))
    throw new Error(`the picture's first dark run is ${run} pixels from its corner, which is no finder pattern of whole pixels a module`)
  const version = (width / pixels - 17) / 4
  if (!Number.isInteger(version) || version < 1 || version > 25)
    throw new Error(`the picture is ${width / pixels} modules across, which is no symbol SIX allows`)
  const millimetres = (pixel: number): number => ((pixel + 0.5) * 46) / width - 23
  // Each module's colour is that of its first pixel outside the cross's square and a pixel's width around it, which are the cross's to say.
  const colours = new Map<number, number>()
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / pixels) * (width / pixels)
    for (let x = 0; x < width; x++) {
      if (Math.max(Math.abs(millimetres(x)), Math.abs(millimetres(y))) <= 3.5 + 46 / width) continue
      const module = row + Math.floor(x / pixels)
      const colour = colours.get(module)
      if (colour === undefined) colours.set(module, data[y * width + x]!)
      else if (data[y * width + x] !== colour)
        throw new Error(`the pixel ${x}, ${y} is not the colour of the module it stands in: the picture is not whole pixels a module`)
    }
  }
  const at = (across: number, down: number): number => data[Math.floor(((down + 23) * width) / 46) * width + Math.floor(((across + 23) * width) / 46)]!
  for (const [across, down, colour] of CROSS_POINTS)
    for (const [mirrorX, mirrorY] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const)
      if (at(across * mirrorX, down * mirrorY) !== (colour === 'white' ? 255 : 0))
        throw new Error(
          `the picture is ${colour === 'white' ? 'black' : 'white'} ${across} mm across and ${down} mm down from its centre, where the Swiss cross is ${colour}`,
        )
  return version
}

/** The white a slip leaves around its code, 5 mm (IG 3.5.2), in the picture's own pixels: what a scanner sees of the page around it. */
function surrounded(png: GreyPixels): GreyPixels {
  const margin = Math.ceil((5 * png.width) / 46)
  const side = png.width + 2 * margin
  const data = new Uint8Array(side * side).fill(255)
  for (let y = 0; y < png.height; y++) data.set(png.data.subarray(y * png.width, (y + 1) * png.width), (y + margin) * side + margin)
  return { width: side, height: side, data }
}

/** What ZXing reads in the Swiss QR Code's pixels, with the white the slip leaves around them, held to the bill: its payload byte for byte, at level M, in the version the pixels are. */
export async function slipCodeProblems(bill: QrBill, code: { readonly png: GreyPixels; readonly version: number }): Promise<string[]> {
  const read = await readPictureCode(surrounded(code.png)).catch((error: unknown) => (error as Error).message)
  if (typeof read === 'string') return [`the slip's code: ${read}`]
  if (read === undefined) return ["the slip's code is a picture no scanner reads a code in"]
  const wanted = new TextEncoder().encode(bill.payload)
  return [
    ...(read.text === bill.payload && read.bytes.length === wanted.length && read.bytes.every((byte, index) => byte === wanted[index])
      ? []
      : ["the slip's code scans to other text, or other bytes, than the bill's payload"]),
    ...(read.ecLevel === 'M' ? [] : [`the slip's code is at level ${read.ecLevel}, where SIX asks for M`]),
    ...(read.version === code.version
      ? []
      : [`the slip's code is a picture of a version ${code.version} symbol in which a scanner reads one of version ${read.version}`]),
  ]
}

/** A slip's Swiss QR Code as a Word file holds it: its picture, the pixels a side it is, the version they are a symbol of, and what a scanner reads in them. */
export interface DocxSlipCode {
  readonly picture: DocxPicture
  readonly side: number
  readonly version: number
  readonly pixels: GreyPixels
  readonly read: PixelCode | undefined
}

/**
 * The Swiss QR Code of `docx`'s slip, read as a scanner reads it from the
 * paper: its picture's pixels with the white the slip leaves around
 * them. Undefined where the file has no slip's page or the page no
 * picture; throws where the picture is no Swiss QR Code's.
 */
export async function readSlipCode(docx: Docx): Promise<DocxSlipCode | undefined> {
  const pictures = (blocks: readonly DocxBlock[]): DocxPicture[] =>
    blocks.flatMap((block) =>
      block.kind === 'paragraph'
        ? block.runs.flatMap((run) => (run.kind === 'picture' ? [run.picture] : []))
        : block.rows.flatMap((row) => row.cells.flatMap((cell) => pictures(cell.blocks))),
    )
  const [picture] = pictures(docx.slip?.blocks ?? [])
  if (picture === undefined) return undefined
  const pixels = readPng(picture.part.bytes)
  return { picture, side: pixels.width, version: swissVersion(pixels), pixels, read: await readPictureCode(surrounded(pixels)) }
}
