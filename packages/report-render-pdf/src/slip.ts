import type { Content, ContentCanvas, ContentStack, ContentSvg, ContentText } from 'pdfmake/interfaces.js'
import { QR_BILL_SIZE, type QrBill } from '@formancy/report-runtime'
import type { CheckedBill } from './bill.js'
import { swissCodeContent } from './qr.js'
import { LIBERATION_ASCENDER, LIBERATION_LINE, LIBERATION_SANS } from './style.js'

/**
 * A QR-bill's slip, the receipt and the payment part, as pdfmake content:
 * where SIX puts each heading, value, field, line and the code, and at what
 * size, in Liberation Sans. Nothing here formats a value: the runtime hands
 * every text as it prints (report-runtime's `QrBill`).
 *
 * The numbers are SIX's: "IG" is the Swiss Implementation Guidelines for
 * the QR-bill, version 2.4, and "SG" its Style Guide, version 1.1, whose
 * page 6 gives every section's place and size in millimetres, page 7 the
 * blank fields', and page 15 the sizes and line spacing. What neither gives
 * is taken from manuelbl's SwissQRBill generator, which matches SG 7 drawn
 * to scale: where the blank amount fields stand, and 2 pt between a
 * debtor's heading and its field.
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

/** The receipt is 62 mm wide, and the payment part starts there (IG 3.3). */
const RECEIPT_WIDTH = mm(62)

/**
 * "Separate before paying in", above the line along the slip's top, outside
 * the payment part, which a PDF's slip may print instead of a scissors
 * symbol (IG 3.7, SG 4): 8 pt, the payment part's heading size, centred
 * over the slip, its baseline 3 pt above the line. SIX gives neither.
 */
const INSTRUCTION = { size: 8, gap: 3 }

/** How far above the slip its drawing starts: the top of the instruction's line. The body ends above it. */
export const ABOVE_SLIP = INSTRUCTION.gap + LIBERATION_ASCENDER * INSTRUCTION.size

/** The lines the slip is cut along (IG 3.7): solid, half a point. SIX gives no weight. */
const SEPARATION = 0.5

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

/** A blank field's corner marks: 3 mm arms, 0.75 pt (IG 3.5.3, SG 7). */
const CORNER = { arm: mm(3), weight: 0.75 }

/** Between a debtor's heading's line and its blank field. */
const FIELD_GAP = 2

/** The titles, "Receipt" and "Payment part": 11 pt bold (IG 3.5.1, 3.6.1). */
const TITLE = 11

/** A part's text: headings bold and 2 pt smaller than their values, every line `pitch` below the one before (IG 3.4, SG 15). */
interface Lettering {
  readonly heading: number
  readonly value: number
  readonly pitch: number
}

/** A part of the slip: where each of its sections starts, and the room its information has. */
interface Part {
  readonly name: string
  readonly lettering: Lettering
  /** Where its title stands, and which heading it prints: "Receipt" or "Payment part". */
  readonly title: { readonly x: number; readonly top: number; readonly heading: 'receipt' | 'paymentPart' }
  /** Whether it prints the additional information: the payment part does, the receipt never (IG 3.6.2). */
  readonly additionalInformation: boolean
  readonly information: { readonly x: number; readonly top: number; readonly width: number; readonly height: number; readonly millimetres: number }
  /** The amount section: its headings' top, and how far the amount stands in from the currency. */
  readonly amount: { readonly x: number; readonly top: number; readonly indent: number; readonly pitch: number }
  /** The blank amount field: its box, and whether its top is the amount's line rather than the section's. */
  readonly amountField: { readonly x: number; readonly width: number; readonly height: number; readonly onAmountLine: boolean }
  readonly debtorField: { readonly width: number; readonly height: number }
}

/** The receipt, 62 by 105 mm (SG 6): 5 mm margins, its title, 56 mm of information, 14 of amount, 18 of acceptance point. */
export const RECEIPT: Part = {
  name: 'the receipt',
  lettering: { heading: 6, value: 8, pitch: 9 },
  title: { x: mm(5), top: mm(5), heading: 'receipt' },
  additionalInformation: false,
  information: { x: mm(5), top: mm(12), width: mm(52), height: mm(56), millimetres: 56 },
  // A receipt's amount is 8 pt on 11 pt (SG 15), 12 mm in (SG 7).
  amount: { x: mm(5), top: mm(68), indent: mm(12), pitch: 11 },
  // 30 by 10 mm, right-aligned to the receipt's text, at the section's top.
  amountField: { x: mm(27), width: mm(30), height: mm(10), onAmountLine: false },
  debtorField: { width: mm(52), height: mm(20) },
}

/** The payment part, 148 by 105 mm (SG 6): the code's 46 mm and the amount's 22 mm beside 87 by 85 mm of information. */
export const PAYMENT_PART: Part = {
  name: 'the payment part',
  lettering: { heading: 8, value: 10, pitch: 11 },
  title: { x: RECEIPT_WIDTH + mm(5), top: mm(5), heading: 'paymentPart' },
  additionalInformation: true,
  information: { x: RECEIPT_WIDTH + mm(56), top: mm(5), width: mm(87), height: mm(85), millimetres: 85 },
  // The payment part's amount is 10 pt on 13 pt (SG 15), 15 mm in (SG 7).
  amount: { x: RECEIPT_WIDTH + mm(5), top: mm(68), indent: mm(15), pitch: 13 },
  // 40 by 15 mm, its right edge at the information section's left, its top where the amount would stand.
  amountField: { x: RECEIPT_WIDTH + mm(16), width: mm(40), height: mm(15), onAmountLine: true },
  debtorField: { width: mm(65), height: mm(25) },
}

/** The Swiss QR Code's place: 5 mm in, below the title section and 5 mm of quiet zone (IG 3.5.2, SG 6). */
const CODE = { x: RECEIPT_WIDTH + mm(5), top: mm(17) }

/** The acceptance point, right-aligned to the receipt's text at the top of its section (IG 3.6.4, SG 6). */
const ACCEPTANCE = { right: mm(57), top: mm(82) }

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
    corner([[left, arm], [left, top], [arm, top]]),
    corner([[width - arm, top], [right, top], [right, arm]]),
    corner([[right, height - arm], [right, bottom], [width - arm, bottom]]),
    corner([[arm, bottom], [left, bottom], [left, height - arm]]),
  ]
}

/** A block of a part's information: a heading over its values, or over a blank field for the payer's hand. */
type Block = { readonly heading: string; readonly values: readonly string[] } | { readonly heading: string; readonly field: Part['debtorField'] }

/** The blocks a part's information holds, in SIX's order (IG 3.5.4, 3.6.2): the additional information in the payment part alone. */
function blocks(bill: QrBill, part: Part): Block[] {
  const { headings } = bill
  return [
    { heading: headings.account, values: [bill.account, ...bill.creditor] },
    ...(bill.reference === null ? [] : [{ heading: headings.reference, values: [bill.reference] }]),
    ...(part.additionalInformation && bill.additionalInformation.length > 0 ? [{ heading: headings.additionalInformation, values: bill.additionalInformation }] : []),
    bill.debtor === null ? { heading: headings.payableBy, field: part.debtorField } : { heading: headings.payableBy, values: bill.debtor },
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
    const title: ContentText = { ...line(block.heading, heading, true, (pitch - shift) / (LIBERATION_LINE * heading)), margin: [0, index === 0 ? 0 : pitch + shift, 0, 0] }
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
  const down = (from: number, to: number): ContentCanvas['canvas'][number] => ({ type: 'line', x1: RECEIPT_WIDTH, y1: from, x2: RECEIPT_WIDTH, y2: to, lineWidth: SEPARATION, lineColor: '#000000' })
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
