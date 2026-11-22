import {
  checkQrBill,
  QR_BILL_SIZE,
  RenderRefusal,
  SLIP_ACCEPTANCE,
  SLIP_FIELD_GAP,
  SLIP_INSTRUCTION,
  SLIP_PAYMENT_PART,
  SLIP_RECEIPT,
  SLIP_TITLE,
  slipBlocks,
  type BillFace,
  type PageSetup,
  type QrBill,
  type QrSymbol,
  type SlipPart,
} from '@formancy/report-runtime'
import { codePoint } from './check-text.js'
import { SEPARATOR } from './nodes.js'
import { SLIP_ASCENDER, SLIP_LINE, slipWidth, unmeasured } from './slip-widths.js'
import { twips } from './units.js'

/**
 * A QR-bill's slip as a Word file states it, planned before a byte is
 * written (0075): every line it prints, each shown to fit where it
 * stands, or the refusal that says why the slip is not written.
 *
 * A Word file's lines are Word's to break, and a row of an exact height
 * cuts what does not fit it. So the slip leaves Word no line to break:
 * each value is broken here, by the widths the slip's face sets it at
 * (`slip-widths.ts`), into lines no wider than SIX's section, each a
 * paragraph of its own; every other text is one line, held to the room
 * its place gives it; and each part's information is held to the height
 * of its section, as the PDF renderer holds it, in the same words. What
 * does not fit is refused, never cut and never set smaller.
 *
 * What refuses a bill before any of that is the runtime's, in the words
 * the PDF renderer refuses it in (`checkQrBill`). One refusal is the
 * writer's own: a character whose width is not known here, which is one
 * outside SIX's characters.
 *
 * A value is broken where the line would otherwise pass its section's
 * width: at a space, which is then the break, or after a hyphen that no
 * digit follows; a word wider than a whole line is broken at the last
 * character that fits. Those are the places the PDF's engine breaks the
 * values the corpus's bills hold, which `slip-against-pdf.test.ts` holds
 * line for line. They are not all of them: the PDF's engine breaks by
 * Unicode's rules and measures with the face's kerning, so a value may
 * break elsewhere there, and a part's information may be a line taller
 * here than in the PDF. A bill at the very height of its section may be
 * refused here and printed there.
 *
 * Every height below is in twentieths of a point, Word's unit, each
 * rounded once, so that where a line stands is the sum of what stands
 * above it, with nothing rounded twice.
 */

/** A block of a part's information as it is written: its heading over its lines, or over a blank field. */
export interface PlannedBlock {
  readonly heading: string
  readonly lines?: readonly string[]
  readonly field?: SlipPart['debtorField']
}

/** A slip that is written: the bill, its code's symbol, and each part's information, line by line. */
export interface PlannedSlip {
  readonly bill: QrBill
  readonly symbol: QrSymbol
  readonly receipt: readonly PlannedBlock[]
  readonly payment: readonly PlannedBlock[]
}

/**
 * The face's own line at `size` points, in whole twentieths and never
 * under it: from its ascender to its descender, which holds the ink of
 * every character it draws. A line of an exact height shorter than this
 * cuts what reaches past it.
 */
export function faceLine(size: number): number {
  return Math.ceil(SLIP_LINE * size * 20 - 1e-9)
}

/** What each line of a part is tall, and the white between two blocks, in twentieths. */
export interface Lettering {
  readonly heading: number
  readonly value: number
  readonly gap: number
}

/**
 * A part's lines: a heading's baseline a pitch above its first value's,
 * as the PDF lays them out (`slip.ts` there), so a heading's line is
 * shorter than the pitch by what a value's ascender is longer than its
 * own. A value's line is SIX's pitch, or the face's own line at its size
 * where that is taller, since a shorter line cuts ink: the payment part's
 * 10 pt stands on 11.2 pt, where SIX's pitch and the PDF's is 11. The
 * white before a heading is a value's line and what the heading's line is
 * short of the pitch.
 */
export function lettering(part: SlipPart): Lettering {
  const { heading, value, pitch } = part.lettering
  const short = twips(pitch - SLIP_ASCENDER * (value - heading))
  const tall = Math.max(twips(pitch), faceLine(value))
  return { heading: short, value: tall, gap: tall + twips(pitch) - short }
}

/** Where a part's information ends, in twentieths from the slip's top: the receipt's at its amount, the payment part's with its section. */
export function informationEnd(part: SlipPart): number {
  return part === SLIP_RECEIPT ? twips(part.amount.top) : twips(part.information.top + part.information.height)
}

/** How tall `blocks` are as `part` writes them, in twentieths: with the paragraph a cell ends in after a field that ends them. */
export function informationHeight(blocks: readonly PlannedBlock[], part: SlipPart): number {
  const { heading, value, gap } = lettering(part)
  let height = 0
  blocks.forEach((block, index) => {
    height += (index === 0 ? 0 : gap) + heading
    if (block.lines !== undefined) height += block.lines.length * value
    if (block.field !== undefined) height += twips(SLIP_FIELD_GAP) + twips(block.field.height)
  })
  return blocks.at(-1)?.field === undefined ? height : height + twips(SEPARATOR)
}

function refuse(code: 'unsupported' | 'content-too-large', what: string): RenderRefusal {
  return new RenderRefusal(code, `the payment part's ${what}`, 'paymentPart')
}

/** A hair past a width that a sum of binary fractions may be and still fit it. */
const HAIR = 1e-9

/** After a hyphen that no digit follows: where a word may be broken, as a line-breaking engine breaks "Saint-Imier" and not "1400.000-53". */
const AFTER_HYPHEN = /(?<=-)(?=[^0-9])/

/**
 * `text` in lines no wider than `width` points at `size`, each as full
 * as it can be: broken at a space or a run of them, which is then no
 * character of either line, after a hyphen that no digit follows, and inside a word only
 * where what stands between two such places is wider than a line alone.
 */
export function broken(text: string, size: number, width: number): string[] {
  const fits = (line: string): boolean => slipWidth(line, 'normal', size) <= width + HAIR
  const lines: string[] = []
  let line = ''
  // Each piece a line may end before, and what joins it to the piece before it on one line: the spaces between two words, which at a
  // break are the break, every one of them, or nothing after a hyphen.
  const words = text.split(/( +)/)
  const pieces = words.flatMap((word, at) =>
    at % 2 === 1 ? [] : word.split(AFTER_HYPHEN).map((piece, index) => ({ piece, joint: index === 0 ? (words[at - 1] ?? '') : '' })),
  )
  pieces.forEach(({ piece, joint }, index) => {
    const longer = index === 0 ? piece : `${line}${joint}${piece}`
    if (fits(longer)) {
      line = longer
      return
    }
    if (index > 0) lines.push(line)
    let rest = [...piece]
    while (!fits(rest.join(''))) {
      // As many characters as fit, and one at the least: a line too narrow for a character holds it all the same, which the widths below rule out.
      let count = 1
      while (count < rest.length && fits(rest.slice(0, count + 1).join(''))) count++
      lines.push(rest.slice(0, count).join(''))
      rest = rest.slice(count)
    }
    line = rest.join('')
  })
  return [...lines, line]
}

/** The room each one-line text of `part` has, in points, beside what the information's lines have. */
function rooms(part: SlipPart, bill: QrBill): Readonly<Record<'title' | 'currencyHeading' | 'currency' | 'amountHeading' | 'amount', number>> {
  const { amount, amountField, information } = part
  const receipt = part === SLIP_RECEIPT
  // Where the part's text ends: the receipt's at its right margin, the payment part's left column at its information.
  const end = receipt ? SLIP_ACCEPTANCE.right : information.x
  const rest = end - amount.x - amount.indent
  const blank = bill.amount === null
  return {
    title: end - part.title.x,
    currencyHeading: amount.indent,
    // Beside a blank field that starts on the amount's line, the currency has what the field leaves it.
    currency: blank && amountField.onAmountLine ? amountField.x - amount.x : amount.indent,
    // Beside a blank field at the section's top, the amount's heading has what the field leaves it.
    amountHeading: blank && !amountField.onAmountLine ? amountField.x - amount.x - amount.indent : rest,
    amount: rest,
  }
}

/** Refuses a text set on one line that is wider than its place: Word would break it, and what follows it would stand lower than SIX puts it. */
function oneLine(what: string, text: string, face: BillFace, size: number, room: number): void {
  const width = slipWidth(text, face, size)
  if (width > room + HAIR)
    throw refuse('content-too-large', `${what} is ${width.toFixed(2)} pt wide at ${size} pt, on one line; its place on the slip is ${room.toFixed(2)} pt wide`)
}

/** `part`'s information, each value broken into its lines, held to its section's width and height. */
function planned(bill: QrBill, part: SlipPart): PlannedBlock[] {
  const { heading, value } = part.lettering
  const { width, height, millimetres, top } = part.information
  const blocks = slipBlocks(bill, part).map((block): PlannedBlock => {
    oneLine(`heading over ${part.name}'s information`, block.heading, 'bold', heading, width)
    return 'field' in block ? block : { heading: block.heading, lines: block.values.flatMap((text) => broken(text, value, width)) }
  })
  if (twips(top) + informationHeight(blocks, part) > informationEnd(part))
    throw new RenderRefusal(
      'content-too-large',
      `${part.name}'s information is taller than its section: SIX gives it ${millimetres} mm (${height.toFixed(2)} pt)`,
      'paymentPart',
    )
  return blocks
}

/**
 * `bill` planned as a Word file's slip, or the refusal that says why it
 * is not written: first what no engine draws of a bill, in the PDF
 * renderer's words; then every one-line text held to its place; then
 * each part's information, the payment part's first, as the PDF renderer
 * measures them.
 */
export function planSlip(bill: QrBill, page: PageSetup): PlannedSlip {
  const { symbol } = checkQrBill(bill, page, (text) => {
    const point = unmeasured(text)
    return point === undefined
      ? undefined
      : `prints ${codePoint(point)}, which is none of the characters SIX allows a bill, the ones whose widths a Word file's slip is laid out by: nothing would show its line to fit`
  })
  const { headings } = bill
  oneLine("heading 'separate'", headings.separate, 'normal', SLIP_INSTRUCTION.size, QR_BILL_SIZE.width)
  oneLine("heading 'acceptancePoint'", headings.acceptancePoint, 'bold', SLIP_RECEIPT.lettering.heading, SLIP_ACCEPTANCE.right - SLIP_RECEIPT.information.x)
  for (const part of [SLIP_RECEIPT, SLIP_PAYMENT_PART]) {
    const room = rooms(part, bill)
    const { heading, value } = part.lettering
    oneLine(`heading '${part.title.heading}'`, headings[part.title.heading], 'bold', SLIP_TITLE, room.title)
    oneLine(`heading 'currency' in ${part.name}`, headings.currency, 'bold', heading, room.currencyHeading)
    oneLine(`heading 'amount' in ${part.name}`, headings.amount, 'bold', heading, room.amountHeading)
    oneLine(`currency in ${part.name}`, bill.currency, 'normal', value, room.currency)
    if (bill.amount !== null) oneLine(`amount in ${part.name}`, bill.amount, 'normal', value, room.amount)
  }
  const payment = planned(bill, SLIP_PAYMENT_PART)
  return { bill, symbol, receipt: planned(bill, SLIP_RECEIPT), payment }
}
