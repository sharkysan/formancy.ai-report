import type { ContentSvg } from 'pdfmake/interfaces.js'
import { EPC_CAPTION, EPC_FRAME, epcModule, qrSymbolVersion, type EpcQrCode, type QrSymbol } from '@formancy/report-runtime'
import { darkRuns, qrContent } from './qr.js'
import { LIBERATION_SANS } from './style.js'
import type { ConvertedSvg } from './svg-content.js'

/**
 * An EPC QR code (EPC069-12 v3.1), drawn as a QR code is (0020): its
 * symbol the runtime's (`epcSymbol`, 0074), encoded once when the document
 * is checked, its dark modules one path filled once over a white square
 * exactly its size.
 *
 * Without a caption it is a QR code's square, its quiet zone of four
 * modules inside it. With Austria's caption it is the PSA's (PSA v3.0 5),
 * laid out by report-spec's `epc-print.ts`, the one place its rules are
 * decided: a frame of half a module with corners of two, four modules
 * from the symbol, and "Zahlen mit Code" at 7 pt in Liberation Sans,
 * reading from bottom to top on the right.
 */

/**
 * Between each end of the caption and the frame's right line, which is
 * broken where the caption stands: one module. The PSA's figure leaves
 * about that, and gives no number.
 */
const CAPTION_GAP = 1

/**
 * Fails the render on anything the SVG converter would otherwise only
 * warn about and draw past: above all a face it could not open, which it
 * would replace by whatever face it last drew in, without a word.
 */
function refuseWarning(warning: string): never {
  throw new Error(`pdfmake's SVG converter could not draw an EPC QR code's caption as written: ${warning}`)
}

/** The code's square: a QR code's without a caption, the PSA's with one. */
export function epcContent(symbol: QrSymbol, code: EpcQrCode): ContentSvg | ConvertedSvg {
  return code.caption === undefined ? qrContent(symbol, code.size) : captionedContent(symbol, code.size)
}

/**
 * A captioned code's square, `size` points a side, drawn in points: white,
 * the frame, the symbol's dark modules as one path, and the caption.
 *
 * Across, from the left, it is what `epcModule` counts: the frame's line,
 * half a module; four modules; the symbol; four modules; and the caption's
 * band, 7 pt, which holds the caption and the frame's right line along
 * its baseline, the line's outer edge the square's right edge. So the
 * frame spans the square's width. Down, the frame is the symbol and four
 * and a half modules above and below it, less than the square by the
 * band and half a module, and stands in the middle of the square's
 * height. The caption reads from bottom to top, its letters' tops towards
 * the symbol, centred on the symbol and no longer than it (report-spec
 * refuses a version whose symbol is shorter), and the frame's right line
 * is broken a module beyond each end of it.
 *
 * The caption is text, drawn by pdfmake's SVG converter in Liberation
 * Sans: it is in the PDF's text, and a reader finds it.
 *
 * What that takes of a 30 mm square (85.04 pt), measured on the PDF on 17
 * October 2026 (`epc-qr-code.test.ts`): the EPC's first example drawn in
 * version 8, modules of 0.479 mm; across, 8.5 modules and the band, 18.54
 * pt, so that the symbol is 78.2 % of the side; down, 9 modules, with
 * 3.16 pt of the square white above the frame and below it. At its
 * corners the frame, rounded by two modules as the PSA's figure is, comes
 * within 3.49 modules of both of the symbol's edges -- 4.93 from its
 * corner, straight -- and so half a module into the square of four
 * modules ISO/IEC 18004 keeps quiet; along the sides, four.
 */
function captionedContent(symbol: QrSymbol, size: number): ConvertedSvg {
  const modules = symbol.modules.length
  const module = epcModule(size, qrSymbolVersion(symbol), 'zahlenMitCode')
  const line = EPC_FRAME.line * module
  const inset = line + EPC_FRAME.distance * module
  const side = modules * module
  const frame = side + 2 * inset
  const top = (size - frame) / 2
  // The frame's line along its middle: its outer edge on the square's sides, and on the frame's top and foot.
  const [left, right, upper, lower] = [line / 2, size - line / 2, top + line / 2, top + frame - line / 2]
  const radius = EPC_FRAME.radius * module
  const centre = top + inset + side / 2
  const broken = (EPC_CAPTION.advance * EPC_CAPTION.size) / 2 + CAPTION_GAP * module
  const corner = (x: number, y: number): string => `A${radius} ${radius} 0 0 1 ${x} ${y}`
  const path = `M${right} ${centre + broken}V${lower - radius}${corner(right - radius, lower)}H${left + radius}${corner(left, lower - radius)}V${upper + radius}${corner(left + radius, upper)}H${right - radius}${corner(right, upper + radius)}V${centre - broken}`
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="#ffffff"/>`,
    `<path d="${path}" fill="none" stroke="#000000" stroke-width="${line}"/>`,
    `<path transform="translate(${inset} ${top + inset}) scale(${module})" d="${darkRuns(symbol, 0)}" fill="#000000"/>`,
    `<text transform="translate(${right} ${centre}) rotate(-90)" text-anchor="middle" font-family="${LIBERATION_SANS}" font-size="${EPC_CAPTION.size}" fill="#000000">${EPC_CAPTION.words}</text>`,
    '</svg>',
  ].join('')
  return { svg, width: size, height: size, options: { warningCallback: refuseWarning } }
}
