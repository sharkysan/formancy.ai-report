import { createHash } from 'node:crypto'
import { assetDigest, RenderRefusal, type AxisChart, type ResolvedFonts } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { chartFaces, type ChartFace } from './chart-faces.js'
import type { Glyphs } from './glyphs.js'
import { planFonts } from './host-fonts.js'
import { fixture } from './testing/documents.js'
import { face, HOST_SANS, HOST_SANS_BOLD } from './testing/fonts.js'

/**
 * The faces a chart's words print in, and what ECharts is told of each:
 * the face pdfmake prints a word in is the one its width was measured in,
 * at the size and in the line ECharts laid it out by, under a name that
 * keeps its widths apart from every other face's.
 */

/** Roboto's four faces, each mapping 'A': the plan's glyphs are not what this reads. */
const ROBOTO: Glyphs = { normal: new Set([0x41]), bold: new Set([0x41]), italics: new Set([0x41]), bolditalics: new Set([0x41]) }

/** Liberation Serif 2.1.5's four faces, the corpus's host font, mapped as the report's serif. */
const SERIF: ResolvedFonts = { serif: fixture('host-fonts').document.fonts!.serif! }

const sales: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'sales',
  width: 300,
  height: 200,
  title: 'Sales',
  legend: [],
  categories: ['North'],
  series: [{ color: '#1f77b4', values: [{ exact: '10.25', text: '10.25' }] }],
  ticks: ['0', '5', '10', '15'].map((exact) => ({ exact, text: exact })),
  valueLabels: false,
}

/** The same chart without a title: it prints no word bold. */
const { title: _title, ...untitled } = sales

/** The name ECharts is told a face by for `key`: its family, and its key's SHA-256 in hex, hashed here by Node's own. */
const named = (family: string, key: string): string => `${family}, f${createHash('sha256').update(key).digest('hex')}`

/** What `chartFaces` refused `run` with, or 'faced' when it did not. */
function refusal(run: () => unknown): RenderRefusal | 'faced' {
  try {
    run()
    return 'faced'
  } catch (error) {
    if (error instanceof RenderRefusal) return error
    throw error
  }
}

describe("a chart's faces", () => {
  // A chart whose style names nothing prints its words in Roboto at 8 pt
  // and its title bold: ECharts told another size than pdfmake prints, or
  // a line of another face, lays words out over each other. Roboto's line
  // at 8 pt is 9.375, its ascender 7.421875 and its descender -1.953125
  // (1900 and -500 of its 2048 units, `fonts.test.ts`), and each face's
  // name ends in the hex of its key's SHA-256, measured with `printf
  // 'Roboto/normal' | shasum -a 256` and the same of 'Roboto/bold' on 12
  // November 2026.
  test('prints in Roboto at 8 pt where the style names nothing, the title bold, in black', () => {
    const roboto = { family: 'Roboto', size: 8, line: 9.375, ascent: 7.421875, descent: -1.953125 }
    const black = { fontStyle: 'normal', fontSize: 8, color: '#000000' }
    expect(chartFaces(sales, planFonts(undefined, ROBOTO))).toEqual({
      words: {
        ...roboto,
        face: 'normal',
        font: { ...black, fontFamily: 'Roboto, f10d39cc9af6d3917b4f77b5b39f06d29c5dfa81e497f996e0c39a319fb24247d', fontWeight: 'normal' },
      },
      title: {
        ...roboto,
        face: 'bold',
        font: { ...black, fontFamily: 'Roboto, f094cc4f6d45d4fd49ddfa44d7b6b57cf8d126fcb7092a7687ff081e77b805b88', fontWeight: 'bold' },
      },
    })
  })

  // A chart's words take the style's token, size, weight, slant and
  // colour, and its title is bold in the same token: words told one face
  // and printed in another are measured wrong by every glyph. Liberation
  // Serif's line at 10 pt is 11.07421875, its ascender 8.9111328125 and its
  // descender -2.1630859375 (1825 and -443 of 2048 units, read from its
  // horizontal header with fontkit on 12 November 2026).
  test("takes the style's token, size, weight, slant and colour, the title bold in the same token", () => {
    const plan = planFonts(SERIF, ROBOTO)
    const serif = { family: 'formancy-host-serif', size: 10, line: 11.07421875, ascent: 8.9111328125, descent: -2.1630859375 }
    const keyOf = (bold: boolean, italic: boolean): string => plan.face('serif', bold, italic, 'x').key()
    expect(chartFaces({ ...sales, style: { font: 'serif', size: 10, italic: true, color: '#336699' } }, plan)).toEqual({
      words: {
        ...serif,
        face: 'italics',
        font: { fontFamily: named(serif.family, keyOf(false, true)), fontWeight: 'normal', fontStyle: 'italic', fontSize: 10, color: '#336699' },
      },
      title: {
        ...serif,
        face: 'bolditalics',
        font: { fontFamily: named(serif.family, keyOf(true, true)), fontWeight: 'bold', fontStyle: 'italic', fontSize: 10, color: '#336699' },
      },
    })
    expect(chartFaces({ ...sales, style: { font: 'serif', bold: true } }, plan).words).toMatchObject({ face: 'bold', font: { fontWeight: 'bold' } })
  })

  // zrender keeps widths process-wide by the font string it measures in:
  // two faces handed under one digest, in other bytes, named alike, would
  // lay the second chart out by the first one's widths. Each is named by
  // the bytes the render embeds for it.
  test('names two faces handed under one digest apart, by their bytes', () => {
    const declared = assetDigest(HOST_SANS)
    const words = (bytes: Uint8Array): ChartFace => chartFaces(untitled, planFonts({ sans: { normal: face('brand', bytes, declared) } }, ROBOTO)).words
    expect(words(HOST_SANS).font.fontFamily).not.toBe(words(HOST_SANS_BOLD).font.fontFamily)
  })

  // zrender writes a text's style attribute unescaped, and the drawing's
  // reader knows a word's face by its family there: a quotation mark,
  // semicolon or colon in the name would end the attribute or the
  // declaration, and a comma part the name. The family is the renderer's
  // own pdfmake family and the key hex, one comma between them, for
  // Roboto and for a host's face.
  test('names each face in characters zrender writes unescaped, its family and key one comma apart', () => {
    const hostSans = { sans: { normal: face('brand', HOST_SANS), bold: face('brand-bold', HOST_SANS_BOLD) } }
    const names = [planFonts(undefined, ROBOTO), planFonts(SERIF, ROBOTO), planFonts(hostSans, ROBOTO)].flatMap((plan) => {
      const faces = chartFaces({ ...sales, style: { font: plan.usable('serif') ? 'serif' : 'sans' } }, plan)
      return [faces.words.font.fontFamily, faces.title!.font.fontFamily]
    })
    for (const name of names) expect(name).toMatch(/^(Roboto|formancy-host-(sans|serif)), f[0-9a-f]{64}$/)
    expect(new Set(names).size).toBe(names.length)
  })

  // A chart in a token the report maps no font to would be measured in one
  // face and printed in none: refused, naming the chart by its id. Its
  // title prints bold, so a family that maps no bold face refuses a chart
  // with a title, and draws one without: a title the chart does not have
  // asks for no face.
  test('refuses a face the report does not map, naming the chart, and asks for the bold one only for a title', () => {
    expect(refusal(() => chartFaces({ ...sales, style: { font: 'mono' } }, planFonts(undefined, ROBOTO)))).toMatchObject({
      code: 'unsupported',
      subject: 'sales',
    })
    const regular = planFonts({ serif: { normal: SERIF.serif!.normal } }, ROBOTO)
    expect(refusal(() => chartFaces({ ...sales, style: { font: 'serif' } }, regular))).toMatchObject({ code: 'unsupported', subject: 'sales' })
    const faces = chartFaces({ ...untitled, style: { font: 'serif' } }, regular)
    expect(faces.title).toBeUndefined()
    expect(faces.words).toMatchObject({ family: 'formancy-host-serif', face: 'normal' })
  })

  // A title of whitespace alone prints nothing, as pdfmake cuts it, and is
  // no title to the check, which asks for no bold face for it: faced in
  // bold all the same, the drawing would refuse what the check passed, in
  // a family that maps no bold face.
  test('asks for no bold face for a title blank once trimmed, as the check asks for none', () => {
    const regular = planFonts({ serif: { normal: SERIF.serif!.normal } }, ROBOTO)
    const faces = chartFaces({ ...sales, title: ' \u00a0\u202f', style: { font: 'serif' } }, regular)
    expect(faces.title).toBeUndefined()
    expect(chartFaces(sales, planFonts(undefined, ROBOTO)).title).toMatchObject({ face: 'bold' })
  })
})
