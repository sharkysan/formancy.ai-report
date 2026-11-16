import { describe, expect, test } from 'vitest'
import type { ChartFace } from './chart-faces.js'
import { held } from './chart-held.js'
import type { PlacedWord } from './chart-svg.js'
import { BARS } from './testing/charts.js'

/**
 * Where a chart's words may stand (`chart-held.ts`), at its edges: what a
 * layout places, and what an empty chart's words are placed at, both
 * reach it through it, and neither places a word a quarter point off an
 * edge on purpose, so the rule's own numbers are held here, word by word.
 */

/** A face no word here is measured in: the rule reads boxes alone. */
const FACE: ChartFace = {
  family: 'Roboto',
  face: 'normal',
  size: 8,
  line: 10,
  ascent: 8,
  descent: -2,
  font: { fontFamily: `Roboto, f${'0'.repeat(64)}`, fontWeight: 'normal', fontStyle: 'normal', fontSize: 8, color: '#000000' },
}

/** A word of `chart` at `x` and `top`, 20 points wide and a line of 10 tall. */
const word = (key: string, x: number, top: number): PlacedWord => ({ key, text: key, title: false, face: FACE, x, top, width: 20, height: 10 })

/** What `held` made of `words` on `BARS`, 300 by 200 points, or what it refused them with. */
function judged(words: readonly PlacedWord[], plot?: { left: number; top: number; width: number; height: number }): unknown {
  try {
    return held(BARS, words, plot)
  } catch (error) {
    return error
  }
}

describe("a chart's words held to its box", () => {
  // A word past an edge prints over what stands beside the chart, by as
  // little as it is past: a quarter point past any of the four edges is
  // refused, naming the chart and its box, and a word at each edge, and
  // two that share an edge, are held as they are.
  test('refuses a word a quarter point past any edge of the box, and holds one at the edge', () => {
    const atEdges = [word('category/0', 0, 0), word('category/1', 280, 190), word('category/2', 20, 0)]
    expect(judged(atEdges)).toBe(atEdges)
    for (const past of [word('tick/0', -0.25, 50), word('tick/1', 50, -0.25), word('tick/2', 280.25, 50), word('tick/3', 50, 190.25)]) {
      expect(judged([past]), past.key).toMatchObject({
        code: 'content-too-large',
        subject: 'sales',
        message: 'the chart sales, 300 by 200 points, has a word that would leave its box',
      })
    }
  })

  // Two words that overlap by a quarter point print one over the other;
  // a word but a value's label in the plot stands over the marks. Each is
  // refused, and a value's label in the plot is held, as is a word beside
  // it that shares its edge.
  test('refuses two words that meet, and a word in the plot that is no value', () => {
    expect(judged([word('category/0', 0, 0), word('category/1', 19.75, 0)])).toMatchObject({
      message: 'the chart sales, 300 by 200 points, has two words that would meet',
    })
    const plot = { left: 50, top: 50, width: 100, height: 100 }
    expect(judged([word('category/0', 30.25, 60)], plot)).toMatchObject({
      message: 'the chart sales, 300 by 200 points, has a word that would stand in its plot',
    })
    const beside = [word('value/0/0', 60, 60), word('category/0', 30, 60)]
    expect(judged(beside, plot)).toBe(beside)
  })
})
