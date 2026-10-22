import { describe, expect, test } from 'vitest'
import { faceKey, FONT_FACE_KEYS } from './font-map.js'
import type { FontFaceKey } from './font-map.js'
import { editable, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/**
 * The font map (0043): a report names which approved font assets each font
 * token prints in, face by face, and the validator holds the mapping to its
 * references and to the faces the report's own styles ask for. `richReport`
 * maps `sans` to a `brand` normal and a `brand-bold` bold face, over two
 * `font/ttf` assets it declares; the cases below start from it.
 *
 * What the renderer does with the bytes -- reading, embedding, refusing a
 * character a face lacks -- is report-render-pdf's, proved on the PDF
 * (0003). Here the mapping is held as data, as every asset reference is.
 */

const errorsOf = (edit: (report: Record<string, unknown>) => void): { code: string; path: string }[] => {
  const report = editable(richReport())
  edit(report)
  const outcome = validateReport(report)
  return outcome.valid ? [] : outcome.errors.map((error) => ({ code: error.code, path: error.path }))
}

describe('faceKey', () => {
  // The face a run of a weight and slant prints in: the four pdfmake draws,
  // never a faux one. A wrong mapping here would send bold text to the
  // normal face, or ask for a face that is never mapped.
  test('names the face for each weight and slant', () => {
    expect(faceKey(false, false)).toBe('normal')
    expect(faceKey(true, false)).toBe('bold')
    expect(faceKey(false, true)).toBe('italic')
    expect(faceKey(true, true)).toBe('boldItalic')
  })

  // Every face key is reached by some weight and slant, and no two reach
  // one: a key no combination names would be a face a map declares and
  // nothing prints in, and two that share one would print one in the other.
  test('names one of the four face keys for every combination', () => {
    const keys = new Set<FontFaceKey>([faceKey(false, false), faceKey(true, false), faceKey(false, true), faceKey(true, true)])
    expect([...keys].sort()).toEqual([...FONT_FACE_KEYS].sort())
  })
})

describe('the font map, read as part of the report', () => {
  // The fixture maps sans; a report that validates with a map is the ground
  // every refusal below is measured against.
  test("richReport's font map validates, and is returned as it was written", () => {
    const outcome = validateReport(richReport())
    expect(outcome.valid).toBe(true)
    expect(outcome.valid ? outcome.report.fonts : undefined).toEqual({ sans: { normal: 'brand', bold: 'brand-bold' } })
  })

  // A map is optional: a report that names no fonts prints in the renderer's
  // own faces, as every report did before 0043.
  test('a report may map no fonts at all', () => {
    expect(errorsOf((report) => delete report.fonts)).toEqual([])
  })

  // Every family and every face: a map of all three families, each with all
  // four faces, over declared font assets, validates, and is read back
  // whole: a face the reader dropped would print its text in another.
  test('maps all three families and all four faces, and reads each back', () => {
    const fonts = {
      // 'title' is serif and bold, so serif maps a bold face.
      sans: { normal: 'brand', bold: 'brand-bold', italic: 'brand', boldItalic: 'brand-bold' },
      serif: { normal: 'serif-r', bold: 'serif-r' },
      mono: { normal: 'mono-r' },
    }
    const report = editable(richReport())
    ;(report.assets as unknown[]).push(
      { id: 'serif-r', mediaType: 'font/ttf', digest: `sha256:${'11'.repeat(32)}` },
      { id: 'mono-r', mediaType: 'font/ttf', digest: `sha256:${'22'.repeat(32)}` },
    )
    setAt(report, '/fonts', fonts)
    const outcome = validateReport(report)
    expect(outcome.valid ? [] : outcome.errors).toEqual([])
    expect(outcome.valid ? outcome.report.fonts : undefined).toEqual(fonts)
  })

  // A CFF-flavoured OpenType font is not a type an asset may declare
  // (FT-Q15): no PDF/A-3b here has embedded one, and readFont reads no CFF
  // outlines, so the author hears it where the asset is declared.
  test('a font asset declared as font/otf is refused', () => {
    expect(errorsOf((report) => setAt(report, '/assets/2/mediaType', 'font/otf'))).toEqual([{ code: 'not-one-of', path: '/assets/2/mediaType' }])
  })

  // A face with no normal is no face: pdfmake draws a family's regular text
  // in `normal`, and a map without one leaves it undrawable.
  test('a family without a normal face is refused', () => {
    expect(errorsOf((report) => setAt(report, '/fonts/sans', { bold: 'brand-bold' }))).toEqual([{ code: 'missing-property', path: '/fonts/sans/normal' }])
  })

  // A face id nothing declares could only be resolved by fetching a font,
  // which no render does.
  test('a face that names no declared asset is refused as unknown-asset', () => {
    expect(errorsOf((report) => setAt(report, '/fonts/sans/bold', 'nowhere'))).toEqual([{ code: 'unknown-asset', path: '/fonts/sans/bold' }])
  })

  // A family this version does not know is a typo or a later version's.
  test('a font token the format does not know is refused', () => {
    expect(errorsOf((report) => setAt(report, '/fonts/display', { normal: 'brand' })).map((error) => error.code)).toEqual(['unknown-property'])
  })

  // An image asset mapped as a face has no glyphs; a font asset drawn as an
  // image has no picture. Both directions, one code each.
  test('an image asset mapped as a face is refused as asset-not-a-font', () => {
    expect(errorsOf((report) => setAt(report, '/fonts/sans/bold', 'seal'))).toEqual([{ code: 'asset-not-a-font', path: '/fonts/sans/bold' }])
  })

  test('a font asset drawn by an image is refused as asset-not-an-image', () => {
    expect(errorsOf((report) => setAt(report, '/regions/reportHeader/0/columns/0/components/0/source/asset', 'brand'))).toEqual([
      { code: 'asset-not-an-image', path: '/regions/reportHeader/0/columns/0/components/0/source/asset' },
    ])
  })
})

describe('missing-face, a style against the map', () => {
  // A bold style set in a family mapped without a bold face: the renderer
  // never fakes one, so the author hears so while editing. The rule reads
  // the style's own font token; unmapped families and text with no token
  // are the renderer's to refuse at print.
  test('a bold style in a mapped family without a bold face is refused', () => {
    const errors = errorsOf((report) => {
      setAt(report, '/fonts/sans', { normal: 'brand' })
      setAt(report, '/styles/4/font', 'sans')
    })
    expect(errors).toEqual([{ code: 'missing-face', path: '/styles/4' }])
  })

  // The three faces a style can ask for, each refused when the family maps
  // it not: bold, italic and bold-italic, from the style's own flags.
  test.each([
    { flags: { bold: true }, needs: 'bold' },
    { flags: { italic: true }, needs: 'italic' },
    { flags: { bold: true, italic: true }, needs: 'boldItalic' },
  ])('a style that is $needs in a family without that face is refused', ({ flags }) => {
    const errors = errorsOf((report) => {
      setAt(report, '/fonts/sans', { normal: 'brand' })
      setAt(report, '/styles/1/bold', flags.bold ?? false)
      setAt(report, '/styles/1/italic', flags.italic ?? false)
    })
    expect(errors).toEqual([{ code: 'missing-face', path: '/styles/1' }])
  })

  // A style that asks for a face the family maps is not refused: the bold
  // 'strong' style in sans, which maps a bold face.
  test('a style whose face the family maps is accepted', () => {
    expect(errorsOf((report) => setAt(report, '/styles/4/font', 'sans'))).toEqual([])
  })

  // A style in a family the report does not map is no missing-face: an
  // unmapped sans prints in Roboto, which has every weight, and an unmapped
  // serif or mono is the renderer's to refuse at print, whatever its weight.
  test('a style in an unmapped family is not refused', () => {
    // 'title' is serif and bold, and the fixture maps only sans.
    expect(errorsOf(() => undefined).filter((error) => error.code === 'missing-face')).toEqual([])
  })
})
