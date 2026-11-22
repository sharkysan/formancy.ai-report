import type { Content, ContentCanvas, ContentStack, ContentSvg, ContentText } from 'pdfmake/interfaces.js'
import {
  QR_BILL_SIZE,
  SLIP_ACCEPTANCE as ACCEPTANCE,
  SLIP_CODE as CODE,
  SLIP_CORNER as CORNER,
  SLIP_FIELD_GAP as FIELD_GAP,
  SLIP_INSTRUCTION as INSTRUCTION,
  SLIP_PAYMENT_PART,
  SLIP_RECEIPT,
  SLIP_RECEIPT_WIDTH as RECEIPT_WIDTH,
  SLIP_SEPARATION as SEPARATION,
  SLIP_TITLE as TITLE,
  slipBlocks as blocks,
  type QrBill,
  type SlipPart as Part,
} from '@formancy/report-runtime'
import type { CheckedBill } from './bill.js'
import { swissCodeContent } from './qr.js'
import { LIBERATION_ASCENDER, LIBERATION_LINE, LIBERATION_SANS } from './style.js'

/**
 * A QR-bill's slip, the receipt and the payment part, as pdfmake content:
 * where SIX puts each heading, value, field, line and the code, and at what
 * size, in Liberation Sans. Nothing here formats a value: the runtime hands
 * every text as it prints (report-runtime's `QrBill`).
 *
 * Where each part stands and at what size is SIX's, stated once below
 * every engine (report-runtime's `slip-print.ts`, 0075), which the Word
 * writer lays its slip out by too. What is the renderer's own is how it is
 * drawn: pdfmake's content, the scissors, and the face's own line.
 *
 * Positions are in points from the slip's top left. The slip is
 * report-spec's `QR_BILL_SIZE`, 210 by 105 mm, and stands at its
 * `QR_BILL_TOP`, spanning the paper's width and ending at its foot (IG
 * 3.1): the size and the place the editor draws its band at and refuses a
 * page by, decided there once. The layout draws it as the last page's
 * footer (`definition.ts`), each part placed on its own.
 */

/** Millimetres in points. */
const mm = (value: number): number => (value * 72) / 25.4

/** How far above the slip its drawing starts: the top of the instruction's line. The body ends above it. */
export const ABOVE_SLIP = INSTRUCTION.gap + LIBERATION_ASCENDER * INSTRUCTION.size

/**
 * The scissors symbol on the line between the receipt and the payment
 * part. IG 3.7 asks that each line "bear the scissors symbol or
 * alternatively the instruction ... above the line (outside the payment
 * part)": the line across the paper has the instruction above it, and a
 * line down the slip has no "above" outside the payment part, so it bears
 * the symbol. SIX gives it no size or place. It is manuelbl's generator's
 * (`BillLayout.drawBorder`, read on 17 October 2026): 3 mm tall, on the
 * line from 5 mm below the slip's top, the line broken where it stands.
 * 2.5 mm wide, so that it keeps to the 5 mm left unprinted on either side
 * of the line (SG 6). Drawn here, since Liberation Sans has no glyph for
 * U+2702, and the same in every language. In millimetres.
 */
const SCISSORS = { top: 5, width: 2.5, height: 3 }

/** The receipt and the payment part, as the runtime states them. */
export const RECEIPT = SLIP_RECEIPT
export const PAYMENT_PART = SLIP_PAYMENT_PART

const ascender = (size: number): number => LIBERATION_ASCENDER * size

/** A circle about `x`, `y` of radius `r`, as an SVG path of four quarters, each ending at one of its extremes. */
function circle(x: number, y: number, r: number): string {
  const k = 0.5523 * r
  return `M${x + r} ${y}C${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r}C${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y}C${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r}C${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y}Z`
}

/**
 * The scissors, open, their points down the line they cut along, drawn in
 * tenths of a millimetre across `SCISSORS`. A ring either side of the line
 * at the top, 1.2 mm across and 0.2 mm thick, each touching the symbol's
 * side, filled with its hole left out; and from each ring a blade, a wedge
 * from the ring's side towards the line to a point 0.45 mm past it at the
 * symbol's foot, the two crossing on the line. Drawn here after the symbol
 * IG 3.7 prints, none of it taken from another generator's drawing.
 */
function scissorsContent(): ContentSvg {
  const [across, tall] = [SCISSORS.width * 10, SCISSORS.height * 10]
  const [line, ring, hole, past] = [across / 2, 6, 4, 4.5]
  const sides = [-1, 1].map((sign) => {
    const centre = line + sign * (line - ring)
    const toward = (degrees: number): string => {
      const radians = (degrees * Math.PI) / 180
      return `${(centre - sign * ring * Math.cos(radians)).toFixed(3)} ${(ring + ring * Math.sin(radians)).toFixed(3)}`
    }
    return { rings: `${circle(centre, ring, ring)}${circle(centre, ring, hole)}`, blade: `M${toward(30)}L${toward(75)}L${line - sign * past} ${tall}Z` }
  })
  const [width, height] = [mm(SCISSORS.width), mm(SCISSORS.height)]
  const blades = sides.map(({ blade }) => `<path d="${blade}" fill="#000000"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${across} ${tall}"><path d="${sides.map(({ rings }) => rings).join('')}" fill="#000000" fill-rule="evenodd"/>${blades}</svg>`
  return { svg, width, height }
}

/** One line of text in Liberation Sans, `lineHeight` times its line tall. */
function line(text: string, size: number, bold: boolean, lineHeight = 1): ContentText {
  return { text, font: LIBERATION_SANS, fontSize: size, bold, lineHeight }
}

/** A blank field's four corners, each two arms of a polyline, stroked inside the box `width` by `height` from the canvas's corner. */
function corners(width: number, height: number): ContentCanvas['canvas'] {
  const [inset, arm] = [CORNER.weight / 2, CORNER.arm]
  const corner = (points: readonly (readonly [number, number])[]): ContentCanvas['canvas'][number] => ({
    type: 'polyline',
    points: points.map(([x, y]) => ({ x, y })),
    lineWidth: CORNER.weight,
    lineColor: '#000000',
  })
  const [left, top, right, bottom] = [inset, inset, width - inset, height - inset]
  return [
    corner([
      [left, arm],
      [left, top],
      [arm, top],
    ]),
    corner([
      [width - arm, top],
      [right, top],
      [right, arm],
    ]),
    corner([
      [right, height - arm],
      [right, bottom],
      [width - arm, bottom],
    ]),
    corner([
      [arm, bottom],
      [left, bottom],
      [left, height - arm],
    ]),
  ]
}

/**
 * A part's information, as one stack laid out from its section's top: the
 * first heading's line at the top, every line's baseline `pitch` below the
 * one before, and a blank line between blocks (SG 15). pdfmake sets each
 * baseline its ascender below its line's top, so a heading's line is made
 * shorter than the pitch by what a value's ascender is longer, and the
 * space before a heading longer by as much.
 */
export function informationContent(bill: QrBill, part: Part): Content[] {
  const { heading, value, pitch } = part.lettering
  const shift = ascender(value) - ascender(heading)
  return blocks(bill, part).flatMap((block, index): Content[] => {
    const title: ContentText = {
      ...line(block.heading, heading, true, (pitch - shift) / (LIBERATION_LINE * heading)),
      margin: [0, index === 0 ? 0 : pitch + shift, 0, 0],
    }
    if ('field' in block) return [title, { canvas: corners(block.field.width, block.field.height), margin: [0, FIELD_GAP, 0, CORNER.weight / 2] }]
    return [title, ...block.values.map((text) => line(text, value, false, pitch / (LIBERATION_LINE * value)))]
  })
}

/** `content` placed with its top left at `x`, `y` on the page, measured from the footer's top, `origin`, where pdfmake lays the footer out. */
function at(content: ContentText | ContentStack | ContentCanvas | ContentSvg, x: number, y: number, origin: number): Content {
  return { ...content, absolutePosition: { x, y: y - origin } }
}

/** `content` laid out `width` wide where it is placed, on a page `paperWidth` wide. */
function within(content: Content[], x: number, width: number, paperWidth: number): ContentStack {
  return { stack: [{ stack: content, margin: [0, 0, paperWidth - x - width, 0] }] }
}

/** A part's title, its amount section and its information, each placed on the page whose slip starts at `top`. */
function partContent(bill: QrBill, part: Part, top: number, origin: number, paperWidth: number): Content[] {
  const { heading, value } = part.lettering
  const { amount } = part
  const headingTop = top + amount.top
  const amountTop = headingTop + ascender(heading) + amount.pitch - ascender(value)
  const field = part.amountField
  return [
    at(line(bill.headings[part.title.heading], TITLE, true), part.title.x, top + part.title.top, origin),
    at(line(bill.headings.currency, heading, true), amount.x, headingTop, origin),
    at(line(bill.currency, value, false), amount.x, amountTop, origin),
    at(line(bill.headings.amount, heading, true), amount.x + amount.indent, headingTop, origin),
    bill.amount === null
      ? at({ canvas: corners(field.width, field.height) }, field.x, field.onAmountLine ? amountTop : headingTop, origin)
      : at(line(bill.amount, value, false), amount.x + amount.indent, amountTop, origin),
    at(within(informationContent(bill, part), part.information.x, part.information.width, paperWidth), part.information.x, top + part.information.top, origin),
  ]
}

/**
 * The slip, as the last page's footer lays it out, its top `top` points
 * down a page `paperWidth` wide: the lines it is cut along, the
 * instruction above the one across and the scissors on the one down, the
 * receipt with its acceptance point, and the payment part with its code.
 * Made anew for each layout, since pdfmake writes its positions into the
 * content it lays out.
 */
export function slipContent({ bill, symbol }: CheckedBill, top: number, origin: number, paperWidth: number): Content[] {
  const down = (from: number, to: number): ContentCanvas['canvas'][number] => ({
    type: 'line',
    x1: RECEIPT_WIDTH,
    y1: from,
    x2: RECEIPT_WIDTH,
    y2: to,
    lineWidth: SEPARATION,
    lineColor: '#000000',
  })
  const separation: ContentCanvas = {
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: QR_BILL_SIZE.width, y2: 0, lineWidth: SEPARATION, lineColor: '#000000' },
      down(0, mm(SCISSORS.top)),
      down(mm(SCISSORS.top + SCISSORS.height), QR_BILL_SIZE.height),
    ],
  }
  const instruction: ContentText = { ...line(bill.headings.separate, INSTRUCTION.size, false), alignment: 'center' }
  const acceptance: ContentText = { ...line(bill.headings.acceptancePoint, RECEIPT.lettering.heading, true), alignment: 'right' }
  return [
    at(instruction, 0, top - ABOVE_SLIP, origin),
    at(separation, 0, top, origin),
    at(scissorsContent(), RECEIPT_WIDTH - mm(SCISSORS.width / 2), top + mm(SCISSORS.top), origin),
    ...partContent(bill, RECEIPT, top, origin, paperWidth),
    at(within([acceptance], RECEIPT.information.x, ACCEPTANCE.right - RECEIPT.information.x, paperWidth), RECEIPT.information.x, top + ACCEPTANCE.top, origin),
    ...partContent(bill, PAYMENT_PART, top, origin, paperWidth),
    at(swissCodeContent(symbol), CODE.x, top + CODE.top, origin),
  ]
}
