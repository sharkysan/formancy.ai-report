import { BILL_EXAMPLES, resolvedBill } from '@formancy/report-corpus'
import { expect, test } from 'vitest'
import { SLIP_ADVANCES, SLIP_ASCENDER, SLIP_LINE, SLIP_RANGES, slipWidth, unmeasured } from './slip-widths.js'
import { LIBERATION, measured } from './testing/advances.js'

/**
 * The widths the writer lays a slip out by (0075), held to the two things
 * they are stated from: the Liberation Sans the PDF renderer ships, whose
 * own tables are read again here, and report-spec's rule of which
 * characters a bill may hold. Stated twice, since the writer may not
 * depend on the renderer and embeds no font: nothing but this holds the
 * two together.
 */

const FACES = ['normal', 'bold'] as const

/** Every code point the table holds a width for. */
const TABLED = SLIP_RANGES.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index))

// A width typed wrong by a unit sets a line a hair wider than the table says: a line shown to fit would be one Word breaks, and the slip's
// sections would stand lower than SIX puts them.
test.each(FACES)("every advance of the %s face is the renderer's Liberation Sans's own", (face) => {
  const stated = SLIP_RANGES.flatMap(([first], range) => SLIP_ADVANCES[face][range]!.map((advance, index) => [first + index, advance] as const))
  expect(stated).toHaveLength(TABLED.length)
  expect(stated.filter(([point, advance]) => LIBERATION[face].of(point) !== advance)).toEqual([])
})

// The line a paragraph of the slip is given is worked out from the face's ascender and its line: another face's would put every baseline elsewhere.
test("the ascender and the line are the face's own, in ems", () => {
  for (const face of FACES) {
    const { ascender, descender, unitsPerEm } = LIBERATION[face]
    expect(SLIP_ASCENDER).toBe(ascender / unitsPerEm)
    expect(SLIP_LINE).toBe((ascender - descender) / unitsPerEm)
  }
})

/** Whether report-spec's rule lets a bill's text hold `point`: asked of the runtime, which resolves a bill with it in its creditor's town or refuses it. */
function allowed(point: number): boolean {
  const town = [{ kind: 'text' as const, text: `a${String.fromCodePoint(point)}a` }]
  try {
    resolvedBill({ ...BILL_EXAMPLES.three, creditor: { ...BILL_EXAMPLES.three.creditor, town } })
    return true
  } catch {
    return false
  }
}

// The table is of SIX's characters and no others: one SIX allows that had no width here would refuse a bill the PDF prints, and one it
// has that SIX does not allow is a width nothing holds to a rule.
test('the characters with a width are the ones report-spec lets a bill hold, and no others', () => {
  expect(TABLED.filter((point) => !allowed(point))).toEqual([])
  // Around the table's own runs: every code point up to the end of Latin Extended-B, and General Punctuation to the currency symbols.
  const around = [
    [0, 0x24f],
    [0x2000, 0x20cf],
  ] as const
  const others = around.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index))
  expect(others.filter((point) => !TABLED.includes(point) && allowed(point))).toEqual([])
  expect(unmeasured('Zürich 8000 €')).toBeUndefined()
  // Greek, which the report prints and SIX does not allow a bill; a line break; and a character past the plane.
  expect(unmeasured('aΩ')).toBe(0x3a9)
  expect(unmeasured('a\nb')).toBe(0x0a)
  expect(unmeasured('a😀')).toBe(0x1f600)
})

// The sum itself, against the font's own tables read by other code: a width in the wrong face, or at the wrong size, fits a line that does not.
test('a text is as wide as the sum of its advances at its size, in its face', () => {
  for (const text of ['Zusätzliche Informationen', 'CH44 3199 9123 0008 8901 2', 'Șoseaua Ștefan cel Mare 42 €', '//S1/10/10201409/11/190512'])
    for (const face of FACES) for (const size of [6, 8, 10, 11]) expect(slipWidth(text, face, size)).toBeCloseTo(measured(text, face, size), 9)
  expect(slipWidth('Währung', 'bold', 8)).toBeGreaterThan(slipWidth('Währung', 'normal', 8))
})
