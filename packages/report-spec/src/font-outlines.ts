/**
 * A TrueType font's outlines, walked once for their structure (0040): the
 * index to location's offsets, and every glyph description they point to,
 * as fontkit reads them when PDFKit measures a glyph and subsets the font.
 *
 * fontkit reads a glyph's header for its box whenever it measures the
 * glyph, empty or not, and decodes the whole description when it subsets
 * the font; it reads each from the glyph data table's start, bounded by
 * nothing but the file (`TTFGlyph`, `TTFSubset`). So that a font this
 * accepts is one fontkit reads, every offset is held in order and inside
 * the file and inside the length loca's record gives -- fontkit reads the
 * offsets to there, and draws a glyph past the last it read as nothing --
 * every glyph's header too, and every description is walked to
 * its end inside its own extent: a simple glyph's contour ends, its
 * instructions, its flags and repeats and the coordinates they say follow;
 * a composite's components, each naming a glyph the font has. Nothing is
 * decoded into points, nothing recurses, and the walk is bounded by the
 * glyph data's bytes. A simple glyph's points times its contours is held to
 * `MAX_FONT_GLYPH_WORK`: fontkit looks each point up among the contour
 * ends (`_decodeSimple`), so one glyph of 32,767 contours and 65,534 points,
 * 66 KB of a font, took PDFKit 1.6 s to subset. And every glyph's points,
 * and its points times its contours, are held together to
 * `MAX_FONT_POINTS` and `MAX_FONT_OUTLINE_WORK`: a composite may reach
 * every glyph the font has, so one printed character can put them all in
 * the subset, which took PDFKit 162 s for one 'A' before the bound (0043);
 * and so are the composites' components, `MAX_FONT_COMPONENTS`, which the
 * subset decodes into a list however many name one glyph.
 *
 * What is not judged: what an outline looks like, whether its points make
 * sense, its instructions, which no PDF reader runs, and whether a
 * component names its own glyph, which fontkit's subset includes once.
 */
import type { FontFile, TableRecord } from './font-file.js'
import { refuse } from './font-refusal.js'
import { MAX_FONT_COMPONENTS, MAX_FONT_GLYPH_WORK, MAX_FONT_OUTLINE_WORK, MAX_FONT_POINTS } from './limits.js'

/** A glyph header: the contour count and the box, ten bytes. */
const HEADER = 10

/** Simple glyph flags (glyf, "Simple Glyph Description"). */
const X_SHORT = 0x02
const Y_SHORT = 0x04
const REPEAT = 0x08
const X_SAME_OR_POSITIVE = 0x10
const Y_SAME_OR_POSITIVE = 0x20

/** Composite glyph flags (glyf, "Composite Glyph Description"). */
const ARGS_ARE_WORDS = 0x0001
const A_SCALE = 0x0008
const MORE_COMPONENTS = 0x0020
const AN_X_AND_Y_SCALE = 0x0040
const A_TWO_BY_TWO = 0x0080

/**
 * The outlines of a font of `glyphs` glyphs whose index to location is in
 * `locFormat`, walked; refused as `no-outlines` when not one glyph has a
 * contour, as a font of bitmaps alone has.
 */
export function readOutlines(file: FontFile, glyphs: number, locFormat: 0 | 1): void {
  const loca = file.table('loca')
  const glyf = file.table('glyf')
  const size = locFormat === 0 ? 2 : 4
  file.need(loca.offset, size * (glyphs + 1), loca)
  if (loca.length < size * (glyphs + 1)) refuse('malformed', `has an index to location table (loca) whose recorded length holds fewer offsets than its ${glyphs} glyphs need`)
  const offsetOf = (glyph: number): number => (locFormat === 0 ? 2 * file.u16(loca.offset + 2 * glyph, loca) : file.u32(loca.offset + 4 * glyph, loca))
  let drawn = 0
  const tally: Tally = { points: 0, work: 0, components: 0 }
  let start = offsetOf(0)
  for (let glyph = 0; glyph < glyphs; glyph++) {
    const end = offsetOf(glyph + 1)
    if (end < start) refuse('malformed', 'has glyph offsets out of order in its index to location table (loca)')
    // fontkit reads the header for the glyph's box even where the glyph is empty.
    file.need(glyf.offset + start, HEADER, glyf)
    file.need(glyf.offset + start, end - start, glyf)
    if (end > start) {
      if (end - start < HEADER) refuse('malformed', 'has a glyph description shorter than its header')
      if (walk(file, glyf, glyf.offset + start, glyf.offset + end, glyphs, tally)) drawn += 1
    }
    start = end
  }
  if (drawn === 0) refuse('no-outlines', 'has no glyph with an outline')
}

/** What the glyphs walked so far hold together: the simple glyphs' points, and their points times their contours, and the composites' components. */
interface Tally {
  points: number
  work: number
  components: number
}

/** One glyph description from `at` to `end`, walked; whether it has a contour or a component. */
function walk(file: FontFile, glyf: TableRecord, at: number, end: number, glyphs: number, tally: Tally): boolean {
  const contours = file.i16(at, glyf)
  if (contours > 0) simple(file, glyf, at + HEADER, end, contours, tally)
  else if (contours < 0) compound(file, glyf, at + HEADER, end, glyphs, tally)
  return contours !== 0
}

/** Refused unless `at` lies inside the description, which ends at `end`. */
function inside(at: number, end: number): void {
  if (at > end) refuse('malformed', 'has a glyph description that runs past its end')
}

/** A simple glyph: its contour ends, its instructions, its flags and the coordinates they say follow, inside its extent, its points and work added to `tally`. */
function simple(file: FontFile, glyf: TableRecord, from: number, end: number, contours: number, tally: Tally): void {
  let at = from + 2 * contours
  inside(at + 2, end)
  const points = file.u16(at - 2, glyf) + 1
  if (points * contours > MAX_FONT_GLYPH_WORK) refuse('too-large', `has a glyph of ${contours} contours and ${points} points, past the ${MAX_FONT_GLYPH_WORK} of the two multiplied that a glyph may be`, "simplify the glyph's outline in a font editor, or use another font")
  tally.points += points
  tally.work += points * contours
  if (tally.points > MAX_FONT_POINTS) refuse('too-large', `has glyphs of more than ${MAX_FONT_POINTS} points together, the most a font's glyphs may have`, 'use a font file that holds fewer scripts')
  if (tally.work > MAX_FONT_OUTLINE_WORK) refuse('too-large', `has glyphs whose points times contours come to more than ${MAX_FONT_OUTLINE_WORK} together, the most a font's glyphs may`, 'use a font file that holds fewer scripts')
  const instructions = file.u16(at, glyf)
  at += 2 + instructions
  let flags = 0
  let coordinates = 0
  // fontkit reads a repeat whole, even past the last point, and the coordinates of every flag it read.
  while (flags < points) {
    inside(at + 1, end)
    const flag = file.u8(at, glyf)
    at += 1
    let times = 1
    if ((flag & REPEAT) !== 0) {
      inside(at + 1, end)
      times += file.u8(at, glyf)
      at += 1
    }
    flags += times
    const x = (flag & X_SHORT) !== 0 ? 1 : (flag & X_SAME_OR_POSITIVE) !== 0 ? 0 : 2
    const y = (flag & Y_SHORT) !== 0 ? 1 : (flag & Y_SAME_OR_POSITIVE) !== 0 ? 0 : 2
    coordinates += times * (x + y)
  }
  inside(at + coordinates, end)
}

/** A composite glyph: its components, each a flag word, a glyph index the font has, its offsets and its transform, inside its extent, counted in `tally`. */
function compound(file: FontFile, glyf: TableRecord, from: number, end: number, glyphs: number, tally: Tally): void {
  let at = from
  let flags = MORE_COMPONENTS
  while ((flags & MORE_COMPONENTS) !== 0) {
    tally.components += 1
    if (tally.components > MAX_FONT_COMPONENTS) refuse('too-large', `has composite glyphs of more than ${MAX_FONT_COMPONENTS} components together, the most a font's glyphs may have`, 'use a font file that holds fewer scripts')
    inside(at + 4, end)
    flags = file.u16(at, glyf)
    if (file.u16(at + 2, glyf) >= glyphs) refuse('malformed', 'has a composite glyph made of a glyph the font does not have')
    at += 4 + ((flags & ARGS_ARE_WORDS) !== 0 ? 4 : 2)
    at += (flags & A_SCALE) !== 0 ? 2 : (flags & AN_X_AND_Y_SCALE) !== 0 ? 4 : (flags & A_TWO_BY_TWO) !== 0 ? 8 : 0
    inside(at, end)
  }
}
