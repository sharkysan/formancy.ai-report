import type { ContentSvg } from 'pdfmake/interfaces.js'
import { QR_QUIET_ZONE, type QrSymbol } from '@formancy/report-runtime'

/**
 * A QR code (ISO/IEC 18004), drawn as vectors.
 *
 * Its symbol is the runtime's (`qrSymbol`, 0074), where what a code is
 * refused by is decided once for every engine: the text is encoded once,
 * when the document is checked (`check.ts`), and the symbol that check
 * returns is the one every pass draws, so what is refused and what is
 * drawn are one decision.
 *
 * The square is the code's `size`, its quiet zone inside it: four modules
 * on every side, white, the symbol between them, so a module is the size
 * over the symbol's modules and eight. The white is drawn whole under the
 * code, so it scans on a tinted section, and the dark modules over it are
 * one path, filled once (`qrContent`).
 */

/**
 * The code's square, exactly `size` points a side: white, and over it its
 * dark modules in black, one path filled once, each run of them in a row a
 * rectangle of it. Drawn in modules, the square's own units, and scaled to
 * `size`.
 *
 * Filled once, because a run filled on its own is blended into the page on
 * its own: where two rows meet inside a pixel, each covers part of it, and
 * a viewer draws a light line between them. The path is drawn as an SVG,
 * because pdfmake 0.3.11 cannot place one in a canvas: its `offsetVector`
 * (`helpers/tools.js`) moves a canvas's rectangles, lines and polylines to
 * where the canvas stands, never a `path`, which stays at the page's
 * corner; and a polyline's points, moved in place, are not put back when a
 * page break makes it lay the document out again. An SVG it places as it
 * places an image.
 */
export function qrContent(symbol: QrSymbol, size: number): ContentSvg {
  const across = symbol.modules.length + 2 * QR_QUIET_ZONE
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${across} ${across}"><rect width="${across}" height="${across}" fill="#ffffff"/><path d="${darkRuns(symbol, QR_QUIET_ZONE)}" fill="#000000"/></svg>`
  return { svg, width: size, height: size }
}

/** The symbol's dark modules as one path's subpaths, a rectangle for each run of them in a row, `offset` modules in from the square's corner. */
export function darkRuns(symbol: QrSymbol, offset: number): string {
  const runs: string[] = []
  symbol.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue
      const start = x
      while (row[x + 1] === true) x++
      const length = x + 1 - start
      runs.push(`M${offset + start} ${offset + y}h${length}v1h-${length}z`)
    }
  })
  return runs.join('')
}

/** Millimetres in points. */
const mm = (value: number): number => (value * 72) / 25.4

/** A Swiss QR Code's side, without a quiet zone, whatever its version (IG 6.4): its modules are this over theirs. */
export const SWISS_CODE_SIZE = mm(46)

/**
 * The Swiss cross over the code's centre (IG 6.4.2), in millimetres: SIX's
 * logo, as schoero's generator draws it, is a white square of 7 mm, a black
 * square of 6 mm on it, and a white cross on that, its arms 7/6 mm wide and
 * 35/9 mm from end to end. manuelbl's draws the same black square and cross
 * on modules it clears, rather than on a white square.
 */
const CROSS = { white: 7, black: 6, arm: 7 / 6, span: 35 / 9 } as const

/**
 * The Swiss QR Code's square, 46 mm a side, without a quiet zone of its own:
 * the slip leaves 5 mm unprinted around it (IG 3.5.2, 6.4.1). White, its
 * dark modules in black as one path filled once, as a `qrCode`'s are, and
 * over them the Swiss cross: its white square, its black square, and its
 * white cross, one path. Drawn in modules and scaled to the side.
 */
export function swissCodeContent(symbol: QrSymbol): ContentSvg {
  const across = symbol.modules.length
  const unit = across / 46
  const centre = across / 2
  const square = (side: number, fill: string): string =>
    `<rect x="${centre - (side * unit) / 2}" y="${centre - (side * unit) / 2}" width="${side * unit}" height="${side * unit}" fill="${fill}"/>`
  const [arm, span] = [(CROSS.arm * unit) / 2, (CROSS.span * unit) / 2]
  const corners: readonly (readonly [number, number])[] = [
    [-arm, -span],
    [arm, -span],
    [arm, -arm],
    [span, -arm],
    [span, arm],
    [arm, arm],
    [arm, span],
    [-arm, span],
    [-arm, arm],
    [-span, arm],
    [-span, -arm],
    [-arm, -arm],
  ]
  const cross = `M${corners.map(([x, y]) => `${centre + x} ${centre + y}`).join('L')}z`
  const size = SWISS_CODE_SIZE
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${across} ${across}"><rect width="${across}" height="${across}" fill="#ffffff"/><path d="${darkRuns(symbol, 0)}" fill="#000000"/>${square(CROSS.white, '#ffffff')}${square(CROSS.black, '#000000')}<path d="${cross}" fill="#ffffff"/></svg>`
  return { svg, width: size, height: size }
}
