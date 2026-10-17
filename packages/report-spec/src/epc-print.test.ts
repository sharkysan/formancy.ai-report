import { describe, expect, test } from 'vitest'
import { EPC_CAPTION, EPC_CAPTION_MODULE, EPC_FRAME, EPC_MAX_VERSION, epcCaptionBreak, epcLeastVersion, epcModule, qrSymbolModules } from './epc-print.js'
import { MILLIMETRES_PER_INCH, POINTS_PER_INCH } from './units.js'

/** A length in points, in millimetres, unrounded. */
const mm = (points: number): number => (points * MILLIMETRES_PER_INCH) / POINTS_PER_INCH

/** One mil, a thousandth of an inch, in millimetres (PSA v3.0 2). */
const MIL = 0.0254

describe("a code's symbol", () => {
  // "Maximum QR code version 13, equivalent to module size 69" and the
  // sample's "version 6, module size 41" (EPC069-12 2.1, 2.3); "QR-Code
  // Version*4+17" (PSA v3.0 2). A symbol counted one module short would
  // draw every module of a code larger than its square.
  test('has four modules a side for each version and 17, at most version 13', () => {
    expect([1, 6, 13].map(qrSymbolModules)).toEqual([21, 41, 69])
    expect(EPC_MAX_VERSION).toBe(13)
  })
})

describe('a module', () => {
  // Without the caption, a code is drawn as a QR code is (0020): its
  // quiet zone of four modules inside its square on every side. Drawn any
  // other way, the same square would hold a code of other modules than a
  // `qrCode` of its size.
  test('is the square over the symbol and its quiet zone, without the caption', () => {
    expect(epcModule(85.04, 6, undefined)).toBeCloseTo(85.04 / (41 + 8), 12)
  })

  // With the caption, the square holds the frame and the caption too
  // (PSA v3.0 5): from the left, the frame's line, four modules of
  // distance, the symbol, four modules of distance and the caption's band,
  // which the frame's right line runs through. Every part counted, they
  // are the square's side exactly; across, the frame is shorter than the
  // band is wide, so it stands inside the square both ways.
  test("leaves the frame and the caption their room in the square, and no more", () => {
    for (const version of [1, 6, 13]) {
      const symbol = qrSymbolModules(version)
      const module = epcModule(85.04, version, 'zahlenMitCode')
      expect((EPC_FRAME.line + 2 * EPC_FRAME.distance + symbol) * module + EPC_CAPTION.band, `version ${version}`).toBeCloseTo(85.04, 9)
      expect((2 * EPC_FRAME.line + 2 * EPC_FRAME.distance + symbol) * module, `version ${version}`).toBeLessThan(85.04)
    }
  })
})

describe("the PSA's frame and caption", () => {
  // The figure of PSA v3.0 5: the frame "Distance = 4 * m" from the
  // modules, the caption "Distance min. 3 * m" from them, corner radius
  // "r = 2 * m", "Line width max. 0,8 * m", "Font size min. 7pt". Four
  // modules on every side meets both distances, and is the quiet zone
  // ISO/IEC 18004 asks for, so the caption never stands inside it.
  test('stand where the figure puts them, within its bounds', () => {
    expect(EPC_FRAME.distance).toBe(4)
    expect(EPC_FRAME.radius).toBe(2)
    expect(EPC_FRAME.line).toBeGreaterThan(0)
    expect(EPC_FRAME.line).toBeLessThanOrEqual(0.8)
    expect(EPC_CAPTION.words).toBe('Zahlen mit Code')
    expect(EPC_CAPTION.size).toBeGreaterThanOrEqual(7)
  })

  // "The minimal width of modules in printouts is 15 mil. The maximum
  // width of modules shall not exceed 20 mil" (PSA v3.0 5), one mil 0.0254
  // mm (2): 0.381 and 0.508 mm, which are 1.08 and 1.44 points exactly.
  test('print modules from 15 to 20 mil', () => {
    expect(EPC_CAPTION_MODULE.least).toBeCloseTo(15 * MIL, 12)
    expect(EPC_CAPTION_MODULE.most).toBeCloseTo(20 * MIL, 12)
  })
})

describe('the room a code with the caption has', () => {
  /** The caption's length at its size, in points: its advance, 15026 of Liberation Sans 2.1.5's 2048 units per em. */
  const CAPTION = EPC_CAPTION.advance * EPC_CAPTION.size

  // The caption stands beside the symbol, centred on it, and is no longer
  // than the symbol is tall (PSA v3.0 5's figure). Its advance is 51.36 pt
  // at 7 pt, held to the PDF by report-render-pdf's `epc-qr-code.test.ts`.
  // A version 7 code in a square of 68.06 pt has modules of 0.403 mm and a
  // symbol of 51.359 pt, just as tall; in 68.05 pt, 51.350 pt. A caption
  // taken for shorter than it is would be drawn over the frame's corners,
  // and one taken for longer would refuse a square that holds it.
  test('is a symbol at least as tall as the caption beside it', () => {
    expect(CAPTION).toBe(51.3583984375)
    expect(qrSymbolModules(7) * epcModule(68.06, 7, 'zahlenMitCode')).toBeGreaterThanOrEqual(CAPTION)
    expect(qrSymbolModules(7) * epcModule(68.05, 7, 'zahlenMitCode')).toBeLessThan(CAPTION)
    expect(epcCaptionBreak(68.06, 7)).toBeUndefined()
    expect(epcCaptionBreak(68.05, 7)).toBe(
      `with the caption, this version 7 code's symbol is 51.35 pt tall in a square of 68.05 pt, shorter than the caption beside it, "Zahlen mit Code" at 7 pt, 51.36 pt long`,
    )
    // Modules of 15 to 20 mil, and still too short: version 5 in 70 pt has modules of 0.488 mm.
    expect(epcCaptionBreak(70, 5)).toMatch(/^with the caption, this version 5 code's symbol is 51\.23 pt tall in a square of 70 pt, shorter than the caption beside it/)
    // Version 1, the smallest, has modules of exactly 15 mil in 38.86 pt, and a symbol of 22.68 pt.
    expect(epcCaptionBreak(38.86, 1)).toMatch(/this version 1 code's symbol is 22\.68 pt tall/)
  })

  // Before a render, the version is not known: a size is refused only when
  // no version from 1 to 13 prints in it, with modules of 15 to 20 mil and
  // a symbol as tall as its caption. Those sizes are one run, from 68.06 to
  // 118.6 pt: below it, every symbol whose modules are 15 mil or more is
  // shorter than the caption; above it, even version 13's modules are over
  // 20 mil. Every size from 30 to 130 pt, in the hundredths of a point a
  // size is stored in, is taken by the size alone exactly when some
  // version prints in it, and refused otherwise: the validator never takes
  // a size the renderer always refuses, nor refuses one it draws. A float
  // compared at a bound would take or refuse the bound by its rounding.
  test('is refused outside the one run of sizes some version prints in, and nowhere inside it', () => {
    for (let hundredths = 3000; hundredths <= 13000; hundredths++) {
      const size = hundredths / 100
      const prints = Array.from({ length: EPC_MAX_VERSION }, (_, index) => index + 1).filter((version) => epcCaptionBreak(size, version) === undefined)
      expect(epcCaptionBreak(size) === undefined, `${size} pt`).toBe(prints.length > 0)
      expect(prints.length > 0, `${size} pt`).toBe(hundredths >= 6806 && hundredths <= 11860)
    }
    expect(epcCaptionBreak(68.05)).toBe(
      'with the caption, a code needs a square of at least 68.06 pt, and this one is 68.05 pt: in a smaller one, no symbol with modules of 0.381 mm (15 mil) or more is as tall as the caption beside it, "Zahlen mit Code" at 7 pt, 51.36 pt long',
    )
    expect(epcCaptionBreak(118.61)).toBe(
      'with the caption, a code needs a square of at most 118.60 pt, and this one is 118.61 pt: in a larger one, even a version 13 code, the largest the EPC allows, has modules over 0.508 mm (20 mil), the widest the PSA prints',
    )
    // A square narrower than the caption's band leaves the code no room at all, and is too small like any other.
    expect(epcCaptionBreak(5)).toMatch(/^with the caption, a code needs a square of at least 68\.06 pt, and this one is 5 pt/)
    expect(mm(epcModule(118.6, EPC_MAX_VERSION, 'zahlenMitCode'))).toBeCloseTo(0.508, 9)
  })

  // A render knows the version the encoder chose, and the same rules
  // refuse that version's modules, in the same words' measure: what is
  // refused is said to the thousandth past the bound, never as the bound.
  test("is refused for the version a render encodes, when that version's modules are outside the PSA's", () => {
    expect(epcCaptionBreak(85.04, 6)).toBe('with the caption, this version 6 code has modules of 0.557 mm in a square of 85.04 pt; the PSA prints them from 0.381 to 0.508 mm (15 to 20 mil) wide')
    expect(epcCaptionBreak(85.04, 13)).toBe('with the caption, this version 13 code has modules of 0.355 mm in a square of 85.04 pt; the PSA prints them from 0.381 to 0.508 mm (15 to 20 mil) wide')
    expect(epcCaptionBreak(85.04, 9)).toBeUndefined()
    // A version 8 code in 69.1 pt has modules of 0.381 mm exactly, which a
    // float computes as 0.38099999999999995: compared so, the bound itself
    // would be refused.
    expect(epcCaptionBreak(69.1, 8)).toBeUndefined()
    expect(epcCaptionBreak(69.09, 8)).toBe('with the caption, this version 8 code has modules of 0.380 mm in a square of 69.09 pt; the PSA prints them from 0.381 to 0.508 mm (15 to 20 mil) wide')
    expect(epcCaptionBreak(38.86, 2)).toMatch(/this version 2 code has modules of 0\.335 mm in a square of 38\.86 pt/)
  })
})

describe('the version a code is drawn at', () => {
  // The EPC allows any version up to 13 (EPC069-12 2.1; "Smaller QR-Code
  // Versions are permitted", PSA v3.0 4), and with the caption the PSA
  // bounds the modules both ways. In a square the author sized, the
  // smallest version that holds a short payload can have modules over 20
  // mil, or a symbol shorter than the caption: a 30 mm square's version 6
  // code has modules of 0.557 mm. A larger version of the same payload at
  // the same level has finer modules and a taller symbol, and scans to the
  // same bytes, so the code is drawn at the least version that prints,
  // never refused for a payload too short for its square. No size prints
  // every payload at the version that just holds it: in a square where
  // version 4's modules are at most 20 mil, version 8's are under 15.
  test('is, with the caption, the least whose modules are at most 20 mil and whose symbol is as tall as the caption', () => {
    expect(epcLeastVersion(85.04, 'zahlenMitCode')).toBe(8)
    expect(epcCaptionBreak(85.04, 7)).toMatch(/modules of 0\.515 mm/)
    expect(epcLeastVersion(68.06, 'zahlenMitCode')).toBe(7)
    expect(epcLeastVersion(118.6, 'zahlenMitCode')).toBe(EPC_MAX_VERSION)
    // In 70 pt, version 5's modules are 0.488 mm, and its symbol shorter than the caption.
    expect(epcLeastVersion(70, 'zahlenMitCode')).toBe(6)
    for (let hundredths = 6806; hundredths <= 11860; hundredths++) {
      const size = hundredths / 100
      const least = epcLeastVersion(size, 'zahlenMitCode')
      expect(least === undefined ? 'none' : epcCaptionBreak(size, least), `${size} pt`).toBeUndefined()
      if (least !== undefined && least > 1) expect(epcCaptionBreak(size, least - 1), `${size} pt`).toBeDefined()
    }
    expect(epcLeastVersion(118.61, 'zahlenMitCode')).toBeUndefined()
  })

  // Without the caption the PSA's bounds do not apply, and a code is the
  // smallest version that holds its payload, as a QR code is (0020).
  test('is, without the caption, the smallest that holds the payload', () => {
    expect(epcLeastVersion(85.04, undefined)).toBe(1)
    expect(epcLeastVersion(500, undefined)).toBe(1)
  })
})
