import {
  QR_BILL_SIZE,
  QR_BILL_TOP,
  SLIP_ACCEPTANCE,
  SLIP_CODE,
  SLIP_CORNER,
  SLIP_FIELD_GAP,
  SLIP_INSTRUCTION,
  SLIP_PAYMENT_PART,
  SLIP_RECEIPT,
  SLIP_RECEIPT_WIDTH,
  SLIP_SEPARATION,
  SLIP_TITLE,
  SWISS_CODE_SIZE,
  type QrBill,
  type SlipPart,
} from '@formancy/report-runtime'
import { BLACK } from './look.js'
import {
  emptyLine,
  paragraphsOf,
  SEPARATOR,
  type BlockNode,
  type CellNode,
  type Line,
  type ParagraphNode,
  type PictureNode,
  type RowNode,
  type SectionNode,
  type TableNode,
} from './nodes.js'
import { faceLine, informationEnd, lettering, type PlannedBlock, type PlannedSlip } from './slip-plan.js'
import { SLIP_ASCENDER, SLIP_FAMILY } from './slip-widths.js'
import { twips } from './units.js'

/**
 * A QR-bill's slip as the paragraphs and tables of a Word file (0075):
 * the receipt and the payment part on a page of their own, the file's
 * last, in a section of its own.
 *
 * **The page** is A4 in portrait whatever the report's is, with no margin
 * at its sides or its foot: the slip spans the paper and ends at its foot
 * (IG 3.1). Its top margin ends where the instruction to separate
 * begins, so the page's first line is that instruction and its second
 * thing the slip, whose top is then report-spec's `QR_BILL_TOP`, 192 mm
 * down, with nothing above it that could grow and push it. It prints
 * neither the report's page header nor its footer (`package.ts`).
 *
 * **The slip** is a table of one row and three cells -- the receipt, the
 * payment part's title, code and amount, and its information -- whose
 * top border is the line the slip is cut along and whose first cell's
 * right border the line between the receipt and the payment part. In
 * each cell every paragraph is a line of an exact height or white of an
 * exact height, so each stands where the sum of what is above it puts
 * it: where SIX puts each section, to Word's twentieth of a point. The
 * row is at least its height, never exactly: a reader that sets a line
 * wider than the planned width, in a face of other widths, breaks it and
 * the row grows, where an exact row would cut it. The row ends four
 * points above the paper's foot, the room the paragraph that must follow
 * a table and an empty footer take, so the line down the slip ends there.
 *
 * **What a Word file's slip is not**: the line down it bears no scissors,
 * since a cell's border cannot be broken where the symbol stands and
 * nobody has seen Word place a drawing over one; the instruction above
 * the line across is the one IG 3.7 allows in the symbol's place. Where
 * in its line Word sets a baseline is Word's. No line is shorter than
 * its face's own at its size (`faceLine`), which would cut ink: the
 * payment part's values stand 11.2 pt apart, where the PDF's stand SIX's
 * 11, and the receipt's lines are the PDF's.
 */

/** A length in twentieths of a point as the nodes state it: in points. */
const points = (twentieths: number): number => twentieths / 20

const CUT: Line = { weight: SLIP_SEPARATION, color: BLACK }
const MARK: Line = { weight: SLIP_CORNER.weight, color: BLACK }

/** The line the instruction to separate stands on, exactly: its baseline's distance from the slip and the face's ascender at its size. */
const INSTRUCTION_LINE = twips(SLIP_INSTRUCTION.gap + SLIP_ASCENDER * SLIP_INSTRUCTION.size)

/** What the slip's row ends above the paper's foot: the paragraph after it, an empty footer's line, and two points over. */
const FOOT = twips(4)

/** Where each cell of the slip starts and the last ends, from the paper's left, in twentieths: the receipt, the payment part, its information, the paper's edge. */
const EDGES = [0, twips(SLIP_RECEIPT_WIDTH), twips(SLIP_PAYMENT_PART.information.x), twips(QR_BILL_SIZE.width)] as const

/** The slip's page: A4 upright, its top margin down to the instruction, nothing at its sides and its foot, and its header and footer at the paper's edges. */
export function slipPage(): Omit<SectionNode, 'references'> {
  return {
    paperWidth: QR_BILL_SIZE.width,
    paperHeight: QR_BILL_TOP + QR_BILL_SIZE.height,
    landscape: false,
    margins: { top: points(twips(QR_BILL_TOP) - INSTRUCTION_LINE), right: 0, bottom: 0, left: 0 },
    header: 0,
    footer: 0,
    firstPage: false,
  }
}

/** One line of the slip: `text` at `size`, on a line exactly `height` twentieths tall. */
function line(text: string, size: number, bold: boolean, height: number, more: Partial<ParagraphNode> = {}): ParagraphNode {
  return {
    kind: 'paragraph',
    // A run of nothing is no run of a file.
    runs: text === '' ? [] : [{ kind: 'text', text, style: { family: SLIP_FAMILY, size, bold, italic: false, color: BLACK } }],
    mark: { family: SLIP_FAMILY, size },
    keepNext: false,
    keepLines: false,
    line: points(height),
    ...more,
  }
}

/** A cell's content as it is stacked: each thing under the last, and how far down the last ends, in twentieths from the cell's top. */
class Stack {
  readonly nodes: BlockNode[] = []
  private end = 0

  /** White down to `top`, which nothing above reaches past: the plan held every height that could. */
  to(top: number): this {
    if (top < this.end) throw new Error(`a slip's cell is ${this.end - top} twentieths of a point past where its next section starts`)
    if (top > this.end) this.add(emptyLine(points(top - this.end)), top - this.end)
    return this
  }

  add(node: BlockNode, height: number): this {
    this.nodes.push(node)
    this.end += height
    return this
  }

  /** The content, ending in a paragraph as a cell must. */
  closed(): BlockNode[] {
    return this.nodes.at(-1)?.kind === 'paragraph' ? this.nodes : [...this.nodes, emptyLine(SEPARATOR)]
  }
}

const cell = (width: number, content: BlockNode[], more: Partial<CellNode> = {}): CellNode => ({ width, content, ...more })

/**
 * A blank field's four corner marks (IG 3.5.3): a table of three rows and
 * three columns, the outer ones as long as a mark's arm, whose four
 * corner cells are each bordered on their two outer sides. `inset`
 * twentieths of nothing stand before it where it starts in from its
 * cell's left.
 */
function corners(width: number, height: number, inset = 0): TableNode {
  const arm = twips(SLIP_CORNER.arm)
  const across = [arm, width - 2 * arm, arm]
  const lead = inset === 0 ? [] : [inset]
  const empty = (): BlockNode[] => [emptyLine(SEPARATOR)]
  const row = (tall: number, upper: 'top' | 'bottom' | undefined): RowNode => ({
    cantSplit: false,
    height: points(tall),
    cells: [
      ...lead.map((each) => cell(each, empty())),
      cell(across[0]!, empty(), upper === undefined ? {} : { borders: { [upper]: MARK, left: MARK } }),
      cell(across[1]!, empty()),
      cell(across[2]!, empty(), upper === undefined ? {} : { borders: { [upper]: MARK, right: MARK } }),
    ],
  })
  return { kind: 'table', grid: [...lead, ...across], padding: { x: 0, y: 0 }, rows: [row(arm, 'top'), row(height - 2 * arm, undefined), row(arm, 'bottom')] }
}

/** A part's information, stacked from where `stack` ends: each block's heading over its lines or its blank field, a blank line between two. */
function information(stack: Stack, blocks: readonly PlannedBlock[], part: SlipPart, indent: number): void {
  const { heading, value, gap } = lettering(part)
  const sizes = part.lettering
  blocks.forEach((block, index) => {
    if (index > 0) stack.add(emptyLine(points(gap)), gap)
    stack.add(line(block.heading, sizes.heading, true, heading, { indent }), heading)
    for (const text of block.lines ?? []) stack.add(line(text, sizes.value, false, value, { indent }), value)
    if (block.field === undefined) return
    const [across, down] = [twips(block.field.width), twips(block.field.height)]
    stack.add(emptyLine(SLIP_FIELD_GAP), twips(SLIP_FIELD_GAP)).add(corners(across, down, twips(indent)), down)
  })
}

/**
 * A part's amount section, `height` twentieths tall: the headings
 * "Currency" and "Amount" over the currency and the amount, or beside
 * and over the blank field a payer writes the amount in. A table, since
 * two texts stand on one line at SIX's distances: its row is at least the
 * section's height, so what follows the section stands where SIX puts it
 * whatever the texts' own height.
 */
function amount(bill: QrBill, part: SlipPart, left: number, end: number, height: number): TableNode {
  const { amount: place, amountField: field } = part
  const sizes = part.lettering
  const indent = place.x - left
  // The amount's line: its baseline a pitch below the headings', so the headings' line is shorter than the pitch by what the value's ascender is longer.
  const head = twips(SLIP_ASCENDER * sizes.heading + place.pitch - SLIP_ASCENDER * sizes.value)
  const body = faceLine(sizes.value)
  const heading = (text: string, more: Partial<ParagraphNode> = {}): ParagraphNode => line(text, sizes.heading, true, head, more)
  const value = (text: string, more: Partial<ParagraphNode> = {}): ParagraphNode => line(text, sizes.value, false, body, more)
  // The section's columns, from its cell's left: the currency's, the amount's, and where the part's text ends.
  const [from, to] = [twips(place.x + place.indent) - twips(left), twips(end) - twips(left)]
  const table = (grid: number[], rows: RowNode[]): TableNode => ({ kind: 'table', grid, padding: { x: 0, y: 0 }, rows })
  const tall = (cells: CellNode[], most = height): RowNode => ({ cantSplit: true, height: points(most), grows: true, cells })
  if (bill.amount !== null) {
    return table(
      [from, to - from],
      [
        tall([
          cell(from, [heading(bill.headings.currency, { indent }), value(bill.currency, { indent })]),
          cell(to - from, [heading(bill.headings.amount), value(bill.amount)]),
        ]),
      ],
    )
  }
  const [box, across, down] = [twips(field.x) - twips(left), twips(field.width), twips(field.height)]
  const blank = (): BlockNode[] => [corners(across, down), emptyLine(SEPARATOR)]
  if (!field.onAmountLine) {
    // The field beside the headings, from the section's top: the amount's heading has what the field leaves it.
    return table(
      [from, box - from, across],
      [
        tall([
          cell(from, [heading(bill.headings.currency, { indent }), value(bill.currency, { indent })]),
          cell(box - from, [heading(bill.headings.amount)]),
          cell(across, blank()),
        ]),
      ],
    )
  }
  // The field under the amount's heading, from the amount's line, and wider than the amount's column: the headings a row, the currency and the field the next.
  return table(
    [box, from - box, box + across - from],
    [
      {
        cantSplit: true,
        cells: [cell(from, [heading(bill.headings.currency, { indent })], { span: 2 }), cell(box + across - from, [heading(bill.headings.amount)])],
      },
      tall([cell(box, [value(bill.currency, { indent })]), cell(across, blank(), { span: 2 })], height - head),
    ],
  )
}

/**
 * The slip's page, whole: the instruction to separate, the slip, and the
 * paragraph a table at the body's end is followed by. `picture` is the
 * Swiss QR Code's, 46 mm a side.
 */
export function slipNodes(slip: PlannedSlip, picture: PictureNode): BlockNode[] {
  const { bill } = slip
  const [receipt, payment] = [SLIP_RECEIPT, SLIP_PAYMENT_PART]
  const title = (part: SlipPart, left: number): ParagraphNode =>
    line(bill.headings[part.title.heading], SLIP_TITLE, true, faceLine(SLIP_TITLE), { indent: part.title.x - left })

  const first = new Stack().to(twips(receipt.title.top)).add(title(receipt, 0), faceLine(SLIP_TITLE)).to(twips(receipt.information.top))
  information(first, slip.receipt, receipt, receipt.information.x)
  const acceptance = twips(SLIP_ACCEPTANCE.top)
  first
    .to(twips(receipt.amount.top))
    .add(amount(bill, receipt, 0, SLIP_ACCEPTANCE.right, acceptance - twips(receipt.amount.top)), acceptance - twips(receipt.amount.top))
    .add(
      line(bill.headings.acceptancePoint, receipt.lettering.heading, true, faceLine(receipt.lettering.heading), {
        align: 'right',
        indentRight: SLIP_RECEIPT_WIDTH - SLIP_ACCEPTANCE.right,
      }),
      faceLine(receipt.lettering.heading),
    )

  const left = SLIP_RECEIPT_WIDTH
  const code: ParagraphNode = {
    kind: 'paragraph',
    runs: [{ kind: 'picture', picture }],
    mark: undefined,
    keepNext: false,
    keepLines: false,
    indent: SLIP_CODE.x - left,
  }
  const section = informationEnd(payment) - twips(payment.amount.top)
  const second = new Stack()
    .to(twips(payment.title.top))
    .add(title(payment, left), faceLine(SLIP_TITLE))
    .to(twips(SLIP_CODE.top))
    // A picture's line is taken as tall as the picture, to the twentieth above it. At single spacing Word adds the descent of the
    // paragraph's mark, a point of the default face: some 0.2 to 0.3 pt, by which the amount under the code would stand 0.1 mm low.
    .add(code, Math.ceil(SWISS_CODE_SIZE * 20))
    .to(twips(payment.amount.top))
    .add(amount(bill, payment, left, payment.information.x, section), section)

  const third = new Stack().to(twips(payment.information.top))
  information(third, slip.payment, payment, 0)

  const widths = [EDGES[1] - EDGES[0], EDGES[2] - EDGES[1], EDGES[3] - EDGES[2]] as const
  const table: TableNode = {
    kind: 'table',
    grid: widths,
    padding: { x: 0, y: 0 },
    rows: [
      {
        cantSplit: true,
        height: points(twips(QR_BILL_SIZE.height) - FOOT),
        grows: true,
        cells: [
          cell(widths[0], first.closed(), { borders: { top: CUT, right: CUT } }),
          cell(widths[1], second.closed(), { borders: { top: CUT } }),
          cell(widths[2], third.closed(), { borders: { top: CUT } }),
        ],
      },
    ],
  }
  return [line(bill.headings.separate, SLIP_INSTRUCTION.size, false, INSTRUCTION_LINE, { align: 'center' }), table, emptyLine(SEPARATOR)]
}

/** What the slip is of the file's paragraphs, characters and runs (`limits.ts`): every paragraph its page holds, and its text, a run to each line. */
export function slipCount(slip: PlannedSlip): { readonly paragraphs: number; readonly characters: number; readonly runs: number } {
  const paragraphs = paragraphsOf(slipNodes(slip, { id: 0, width: SWISS_CODE_SIZE, height: SWISS_CODE_SIZE, embed: 'rId0' }))
  const texts = paragraphs.flatMap((paragraph) => paragraph.runs.flatMap((run) => (run.kind === 'text' ? [run.text] : [])))
  return { paragraphs: paragraphs.length, characters: texts.reduce((sum, text) => sum + text.length, 0), runs: texts.length }
}
