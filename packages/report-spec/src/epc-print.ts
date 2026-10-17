/**
 * How an EPC QR code is printed: the side of its modules in the square it
 * stands in, and, with Austria's caption, the frame and the words around
 * it and the modules' widths the PSA allows ("QR-Code und BCD Definition",
 * PSA version 3.0, section 5, and its figure there).
 *
 * The EPC gives no size and no caption (EPC069-12 v3.1): a code without
 * the caption is drawn as a QR code is (0020), its quiet zone of four
 * modules inside its square, and held by the renderer to the same 0.4 mm
 * floor. The caption brings the PSA's rules with it, and they are decided
 * here once: the validator applies them to a size, which no data changes,
 * for every version a code may have; the renderer to the version the
 * encoder chose. Two copies could disagree about which sizes print, and
 * nobody would find out until a bank's app could not read one.
 */
import type { EpcCaption } from './epc-qr-code.js'
import { MILLIMETRES_PER_INCH, POINTS_PER_INCH } from './units.js'

/** The largest version a code may have: 69 modules a side, which holds 331 bytes at level M (EPC069-12 2.1). */
export const EPC_MAX_VERSION = 13

/** The modules a side of a symbol of `version` has: "QR-Code Version*4+17" (PSA 2; ISO/IEC 18004). */
export function qrSymbolModules(version: number): number {
  return 4 * version + 17
}

/**
 * The frame around a captioned code, in modules (PSA 5's figure): four
 * between the symbol and the frame -- "Distance = 4 * m" -- and between
 * the symbol and the caption, which the figure asks "min. 3 * m" of: four
 * meets both, and keeps ISO/IEC 18004's quiet zone of four clear of the
 * caption. The corner's radius is "r = 2 * m". The line is at most "0,8 *
 * m" wide; half a module is drawn, clearly within it.
 */
export const EPC_FRAME = { distance: 4, radius: 2, line: 0.5 } as const

/**
 * The caption (PSA 5): "Zahlen mit Code", "to the right from bottom to
 * top", at "Font size min. 7pt" in "Arial o.s. non-serifs" -- Liberation
 * Sans, the QR-bill's face, here. Its band, in points, is the room to the
 * right of the symbol's distance, to the square's edge: one em of the
 * caption's size. It holds the caption's letters, which reach 0.725 em
 * above their baseline and 0.01 em below it in Liberation Sans 2.1.5, and
 * the frame's right line, which runs along the caption's baseline and is
 * broken where the caption stands, as in the PSA's figure.
 *
 * Its advance, in ems, is its fifteen glyphs' in Liberation Sans 2.1.5:
 * 15026 of the face's 2048 units per em, as fontkit lays them out for
 * PDFKit, with no kerning between these letters -- 51.36 pt at 7 pt,
 * measured on 17 October 2026, and held to the PDF the renderer draws by
 * report-render-pdf's `epc-qr-code.test.ts`. The caption stands beside the
 * symbol, centred on it, and no longer than the symbol is tall, as in the
 * figure, so that the frame's right line is drawn above and below it.
 */
export const EPC_CAPTION = { words: 'Zahlen mit Code', size: 7, band: 7, advance: 15026 / 2048 } as const

/**
 * The modules' widths the PSA prints, in millimetres: "minimal ... 15 mil",
 * "shall not exceed 20 mil" (PSA 5), a mil 0.0254 mm (PSA 2). They are
 * 1.08 and 1.44 points exactly, `MODULE_HUNDREDTHS`.
 */
export const EPC_CAPTION_MODULE = { least: 0.381, most: 0.508 } as const

/** The PSA's modules in hundredths of a point: 15 and 20 mil, a mil 0.072 pt. */
const MODULE_HUNDREDTHS = { least: 108, most: 144 } as const

/**
 * The side, in points, of one module of a code of `version` in a square of
 * `size`. Without a caption, the square holds the symbol and its quiet zone
 * of four modules a side, as a QR code's does (0020). With one, it holds,
 * from the left, the frame's line, the distance, the symbol, the distance
 * and the caption's band; down, the frame and the distance alone, which
 * take less room than the band does across.
 */
export function epcModule(size: number, version: number, caption: EpcCaption | undefined): number {
  const symbol = qrSymbolModules(version)
  if (caption === undefined) return size / (symbol + 8)
  return (size - EPC_CAPTION.band) / (EPC_FRAME.line + 2 * EPC_FRAME.distance + symbol)
}

/** Twice the modules across a captioned code of `version`, its frame's line and distances counted: a whole number, so that the bounds compare exactly. */
function twiceAcross(version: number): number {
  return 2 * (EPC_FRAME.line + 2 * EPC_FRAME.distance + qrSymbolModules(version))
}


/** A size in the whole hundredths of a point it is stored in. */
const hundredths = (size: number): number => Math.round(size * 100)

/** The caption's band in hundredths of a point. */
const BAND = EPC_CAPTION.band * 100

/** Whether a captioned code of `version` in a square of `size` has modules of at least 15 mil, or at most 20, compared in whole hundredths. */
function modulesAre(size: number, version: number, bound: 'least' | 'most'): boolean {
  const room = 2 * (hundredths(size) - BAND)
  const limit = MODULE_HUNDREDTHS[bound] * twiceAcross(version)
  return bound === 'least' ? room >= limit : room <= limit
}

/** The caption's length in hundredths of a point: its advance at its size, exact, as every multiple of a 2048th is in binary. */
const CAPTION_HUNDREDTHS = EPC_CAPTION.advance * EPC_CAPTION.size * 100

/**
 * Whether the symbol of a captioned code of `version` in a square of
 * `size` is as tall as the caption beside it. The symbol is its modules
 * times a module, `2 * symbol * (size - band) / twiceAcross`; compared
 * with the caption's length without the division, exactly.
 */
function captionBeside(size: number, version: number): boolean {
  return CAPTION_HUNDREDTHS * twiceAcross(version) <= 2 * qrSymbolModules(version) * (hundredths(size) - BAND)
}

/** Whether a captioned code of `version` prints in a square of `size`: its modules from 15 to 20 mil, and its symbol as tall as its caption. */
function prints(size: number, version: number): boolean {
  return modulesAre(size, version, 'least') && modulesAre(size, version, 'most') && captionBeside(size, version)
}

/** Every version a code may have, from the smallest. */
const VERSIONS: readonly number[] = Array.from({ length: EPC_MAX_VERSION }, (_, index) => index + 1)

/**
 * The squares some version prints a captioned code in, in hundredths of a
 * point. Each version prints from where its modules are 15 mil and its
 * symbol as tall as the caption, to where its modules are 20 mil; a
 * version whose symbol is shorter than the caption even at 20 mil starts
 * past where it ends, and above where a larger version starts. The runs
 * of the versions from 1 to 13 overlap into one, from the least start to
 * version 13's end, which `epc-print.test.ts` holds for every size: a size
 * outside it is refused, and none inside.
 */
const CAPTION_SQUARES = {
  least: Math.min(
    ...VERSIONS.map((version) => {
      const across = twiceAcross(version)
      return Math.max(BAND + (MODULE_HUNDREDTHS.least * across) / 2, BAND + Math.ceil((CAPTION_HUNDREDTHS * across) / (2 * qrSymbolModules(version))))
    }),
  ),
  most: BAND + (MODULE_HUNDREDTHS.most * twiceAcross(EPC_MAX_VERSION)) / 2,
} as const

/**
 * The least version a code is drawn at in a square of `size`. Without the
 * caption, 1: the encoder takes the smallest that holds the payload, as
 * for a QR code. With it, the least whose modules are at most 20 mil and
 * whose symbol is as tall as the caption, so that a payload too short for
 * the square is drawn in a larger version of itself, at the same level,
 * rather than refused; none where even version 13's modules are over 20
 * mil. Whether the version the payload then needs has modules of 15 mil
 * or more is `epcCaptionBreak`'s to say.
 */
export function epcLeastVersion(size: number, caption: EpcCaption | undefined): number | undefined {
  if (caption === undefined) return 1
  return VERSIONS.find((version) => modulesAre(size, version, 'most') && captionBeside(size, version))
}

/**
 * A module's width in millimetres, said to the thousandth on the side of
 * the bound it breaks, so that one past a bound never reads as the bound;
 * none at all where the square is narrower than the caption's band.
 */
function said(size: number, version: number, past: 'under' | 'over'): string {
  const width = Math.max(0, (epcModule(size, version, 'zahlenMitCode') * MILLIMETRES_PER_INCH) / POINTS_PER_INCH)
  const rounded = past === 'under' ? Math.floor(width * 1000 + 1e-9) : Math.ceil(width * 1000 - 1e-9)
  return (rounded / 1000).toFixed(3)
}

/** Hundredths of a point as points, to the hundredth. */
const points = (value: number): string => (value / 100).toFixed(2)

/** The caption, its size and its length, rounded up, as a refusal names it. */
const CAPTION_SAID = `"${EPC_CAPTION.words}" at ${EPC_CAPTION.size} pt, ${points(Math.ceil(CAPTION_HUNDREDTHS))} pt long`

/**
 * The rule a captioned code in a square of `size` breaks, or undefined. A
 * render passes the version the encoder chose, and the rules are that
 * version's: modules from 15 to 20 mil, and a symbol as tall as the
 * caption. The validator knows no version and passes none, and refuses
 * only a size in which no version from 1 to 13 prints, naming the run of
 * sizes some version does. Sizes are compared in the hundredths of a point
 * they are stored in, exactly.
 */
export function epcCaptionBreak(size: number, version?: number): string | undefined {
  const square = `in a square of ${size} pt`
  if (version === undefined) {
    if (VERSIONS.some((each) => prints(size, each))) return undefined
    return hundredths(size) < CAPTION_SQUARES.least
      ? `with the caption, a code needs a square of at least ${points(CAPTION_SQUARES.least)} pt, and this one is ${size} pt: in a smaller one, no symbol with modules of 0.381 mm (15 mil) or more is as tall as the caption beside it, ${CAPTION_SAID}`
      : `with the caption, a code needs a square of at most ${points(CAPTION_SQUARES.most)} pt, and this one is ${size} pt: in a larger one, even a version ${EPC_MAX_VERSION} code, the largest the EPC allows, has modules over 0.508 mm (20 mil), the widest the PSA prints`
  }
  if (!modulesAre(size, version, 'least') || !modulesAre(size, version, 'most')) {
    const past = modulesAre(size, version, 'least') ? 'over' : 'under'
    return `with the caption, this version ${version} code has modules of ${said(size, version, past)} mm ${square}; the PSA prints them from 0.381 to 0.508 mm (15 to 20 mil) wide`
  }
  if (!captionBeside(size, version)) {
    const tall = Math.floor(qrSymbolModules(version) * epcModule(size, version, 'zahlenMitCode') * 100 + 1e-9)
    return `with the caption, this version ${version} code's symbol is ${points(tall)} pt tall ${square}, shorter than the caption beside it, ${CAPTION_SAID}`
  }
  return undefined
}
