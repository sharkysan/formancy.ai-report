import { RenderRefusal, type AxisChart, type PieChart } from '@formancy/report-runtime'
import type { ChartFace, ChartFaces } from './chart-faces.js'
import { AXIS, GRID, type ChartWord } from './chart-option.js'
import type { FaceWidths } from './engine.js'
import { PDF_A_NESTING } from './svg-pdfa.js'

/**
 * The SVG ECharts writes of a chart, held to what ECharts 6.1.0 was seen to
 * write and read back (0058). ECharts lays a chart out and draws its marks,
 * and pdfmake prints each of its words where ECharts placed it: the drawing
 * pdfmake's SVG converter is handed holds no word, no style sheet and no
 * clip. Each `<text>` is taken out and read back as the box pdfmake prints
 * its word in, and the one `<style>` ECharts writes, of hover rules that
 * print nothing, is removed.
 *
 * So is every clip it writes, which ECharts 6.1.0 writes of a line series
 * alone (`chart-svg.test.ts`): it clips a bar by working out each one, and
 * a pie and a legend not at all. It clips every line series to its plot,
 * whatever its `clip` says: to the plot widened by half the line's width,
 * or, with `clip: false`, as the option sets it, by the plot's longer side
 * (LineView.js `createLineClipPath`); and svg-to-pdfkit draws a clip path
 * as a group the size of the page under a luminosity soft mask, which a
 * reader composites for each series. It cuts nothing: every value stands
 * inside the ticks (`check-chart.ts`), and what a clip holds is stroked
 * with bevelled joins and butt ends, which stand no farther from a line's
 * points than half its width, and is refused stroked otherwise. Each clip
 * is still held as it is written, a path it defines once in zrender's
 * black, before it is taken out with every `clip-path` that names it; the
 * line is drawn as ECharts wrote it, inside the chart's box, which the
 * converter clips it to.
 *
 * A pie's arcs alone are not as ECharts wrote them: the drawing writes them
 * again before they are read (`chart-arcs.ts`). zrender writes a slice's
 * arc between ends rounded to a tenth of a point, and the converter draws
 * an arc on the circle through its ends: in the renders measured on
 * 2026-11-13, up to 5 pt off the pie's near half a turn and 69 pt near a
 * whole one, or no circle at all, and nothing drawn. Written again, each
 * is arcs of at most a quarter turn on the pie's own circle, in the
 * grammar ECharts writes an arc in, so that the reader holds them, and
 * every number of them the converter is handed, as it holds ECharts' own.
 *
 * The drawing is ECharts', made of the runtime's words, and read as
 * untrusted: it is held whole before anything of it is used, and refused
 * as `unsupported`, naming the chart and quoting nothing of the drawing,
 * where it holds
 *
 * - an element or an attribute `CHART_DRAWN` does not list, an element
 *   inside one ECharts does not write it in, a value ECharts does not
 *   write an attribute with, or a `<text>` or the `<svg>` without what
 *   reading it needs, or a shape without its fill, which zrender always
 *   writes and SVG paints black where it is left out;
 * - a comment, a DOCTYPE or a processing instruction; or CDATA but in the
 *   one style sheet, a child of the `<svg>`, every selector of whose rules
 *   ends in `:hover`;
 * - an entity or a character reference but the five zrender's `encodeHTML`
 *   writes, `&amp; &lt; &gt; &quot; &#39;`, or a character it escapes,
 *   unescaped;
 * - a number that is not finite, or past the box by more than the box's
 *   longer side -- of a path, each point it reaches as the converter takes
 *   it, a relative step's from the point before it and never the step, and
 *   an arc's radius, every arc a circle's (`reached`): every number the
 *   converter writes of a chart is then far under what a PDF/A holds
 *   (`svg-pdfa.ts`'s `SVG_INTEGER_BOUND`);
 * - groups nested deeper than a PDF/A nests the graphics state;
 * - a `fill` or a `stroke` the option did not name -- the block's, the
 *   grid's, the axis's or the words' -- `none` and `transparent` aside, or
 *   in a clip path anything but zrender's black, a mask that paints
 *   nothing; or a clip by a path it does not define once;
 * - a stroke inside a clip but with bevelled joins and butt ends, a
 *   join written or not, since SVG mitres one it is not told of: the
 *   condition on which the clip, taken out, cut nothing;
 * - a `<text>` turned or scaled, which the option never asks for;
 * - a `<text>` whose word, its entities read, is not one of the words the
 *   layout prints not yet placed, in its face; or a word the layout prints
 *   that no `<text>` holds. An empty `<text>` is no word.
 *
 * A word's box is where pdfmake prints it, which is where zrender laid it
 * out: as wide as the word's advance in its face (`FaceWidths.width`), its
 * left by its anchor -- its start, its middle or its end -- at its
 * translation and its own x; `dominant-baseline: central`, as zrender lays
 * it out and svg-to-pdfkit reads it, is the centre of the face's line at
 * its translation and its own y, so that its top is half a line above, and
 * its baseline the face's ascent below its top.
 *
 * Two words of one text in one face print alike, but are not one word: a
 * tick's label and a value's stand apart, and the layout's rules read
 * which is which. They are told apart by the order ECharts 6.1.0 writes a
 * chart's words in (`WRITTEN`).
 */

/** A number as zrender writes one: JavaScript's own spelling of a double -- a sign, digits, a point and digits, an exponent. */
const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:e[+-]?\d+)?`

/** A fill or a stroke as zrender writes one: a hex colour, or nothing. */
const PAINT = '#[0-9a-f]{3}|#[0-9a-f]{6}|none|transparent'

/** A translation as zrender writes one, to four places. */
const TRANSLATE = String.raw`translate\(${NUMBER} ${NUMBER}\)`

/**
 * Each element of the drawing as ECharts 6.1.0 writes it: its attributes,
 * each with the values it is written with, those it is never written
 * without that the drawing is read by, and what it is written inside, the
 * `<svg>` inside nothing.
 */
const VOCABULARY: Readonly<
  Record<string, { readonly attributes: Readonly<Record<string, string>>; readonly required?: readonly string[]; readonly inside: readonly string[] }>
> = {
  svg: {
    attributes: {
      width: NUMBER,
      height: NUMBER,
      xmlns: String.raw`http://www\.w3\.org/2000/svg`,
      'xmlns:xlink': String.raw`http://www\.w3\.org/1999/xlink`,
      version: String.raw`1\.1`,
      baseProfile: 'full',
      viewBox: `${NUMBER} ${NUMBER} ${NUMBER} ${NUMBER}`,
    },
    required: ['width', 'height', 'viewBox'],
    inside: [],
  },
  // A shape zrender always writes with its fill, `none` where it fills nothing (svg/mapStyleToAttrs.js): one without paints black.
  rect: { attributes: { width: NUMBER, height: NUMBER, x: NUMBER, y: NUMBER, fill: PAINT }, required: ['fill'], inside: ['svg', 'g'] },
  path: {
    attributes: {
      // As zrender's path writer writes one (svg/SVGPathRebuilder.js): a move, then moves, lines, a rectangle's sides relative,
      // curves, arcs and closes, each its letter and its numbers, a space between them; an arc a circle's, unturned, as ECharts
      // draws every one (`arc`, its radius twice) and the drawing writes a pie's again (`chart-arcs.ts`), its flags 0 or 1. Or
      // nothing at all, which ECharts writes for a line series with no value at any category beside one that has (ECPolyline),
      // and the converter draws as nothing.
      d: String.raw`(?:M${NUMBER} ${NUMBER}(?:[MLl]${NUMBER} ${NUMBER}|C${NUMBER}(?: ${NUMBER}){5}|Q${NUMBER}(?: ${NUMBER}){3}|A(?<radius>${NUMBER}) \k<radius> 0 [01] [01] ${NUMBER} ${NUMBER}|Z)*)?`,
      // A path moved, or a line's marker scaled and moved.
      transform: String.raw`${TRANSLATE}|matrix\(${NUMBER}(?:,${NUMBER}){5}\)`,
      fill: PAINT,
      stroke: PAINT,
      'stroke-width': NUMBER,
      'stroke-linecap': 'butt|round|square',
      'stroke-linejoin': 'miter|round|bevel',
      'stroke-miterlimit': NUMBER,
      'pointer-events': 'visible',
      class: String.raw`zr\d+-cls-\d+`,
      ecmeta_series_index: String.raw`\d+`,
      ecmeta_data_index: String.raw`\d+`,
      ecmeta_ssr_type: 'chart|legend',
      ecmeta_silent: 'true',
    },
    required: ['fill'],
    inside: ['svg', 'g', 'clipPath'],
  },
  text: {
    attributes: {
      'dominant-baseline': 'central',
      'text-anchor': 'start|middle|end',
      // A word's face as zrender writes a separate font (svg/graphic.js `brushSVGTSpan`), its family as `ChartFace.font` names it.
      style: String.raw`font-size:${NUMBER}px;font-family:[\w-]+, f[0-9a-f]{64};(?:font-style:italic;)?(?:font-weight:bold;)?`,
      'xml:space': 'preserve',
      x: NUMBER,
      y: NUMBER,
      // Moved, and never turned or scaled: the option turns no word.
      transform: TRANSLATE,
      fill: PAINT,
    },
    required: ['dominant-baseline', 'text-anchor', 'style'],
    inside: ['svg', 'g'],
  },
  g: { attributes: { 'clip-path': String.raw`url\(#[A-Za-z][\w-]*\)` }, inside: ['svg', 'g'] },
  defs: { attributes: {}, inside: ['svg'] },
  clipPath: { attributes: { id: String.raw`[A-Za-z][\w-]*` }, inside: ['defs'] },
  style: { attributes: {}, inside: ['svg'] },
}

/** An element's vocabulary as the reader holds a drawing to it: each attribute's values a whole match. */
interface Vocabulary {
  readonly values: ReadonlyMap<string, RegExp>
  readonly required: readonly string[]
  readonly inside: ReadonlySet<string>
}

/** `VOCABULARY`, as the reader holds a drawing to it. */
const ELEMENTS: ReadonlyMap<string, Vocabulary> = new Map(
  Object.entries(VOCABULARY).map(([element, { attributes, required = [], inside }]) => [
    element,
    {
      values: new Map(Object.entries(attributes).map(([attribute, pattern]) => [attribute, new RegExp(`^(?:${pattern})$`)])),
      required,
      inside: new Set(inside),
    },
  ]),
)

/**
 * What ECharts 6.1.0 writes for a bar, a line and a pie, as the spike that
 * chose how a chart is drawn listed it (0058): each element and its
 * attributes, less the spike's `fill-opacity`, which only ECharts' theme's
 * title and legend backgrounds were written with and the option's
 * transparent ones are not; `chart-svg.test.ts` holds the list to what the
 * three kinds are drawn with. svg-content.ts's `DRAWN` is an asset's, and
 * neither borrows the other's.
 */
export const CHART_DRAWN: ReadonlyMap<string, ReadonlySet<string>> = new Map([...ELEMENTS].map(([element, { values }]) => [element, new Set(values.keys())]))

/** Whether `d` is a path as ECharts writes one, which the reader holds (`VOCABULARY`). */
export const heldPath = (d: string): boolean => ELEMENTS.get('path')?.values.get('d')?.test(d) === true

/** The attributes whose numbers are coordinates or lengths in the drawing, each held to the box; a path's are the points it reaches (`reached`). */
const MEASURES: ReadonlySet<string> = new Set(['width', 'height', 'x', 'y', 'stroke-width', 'stroke-miterlimit', 'viewBox', 'transform'])

/** Every number in an attribute's value, each read by `matchAll`, which reads a copy. */
const NUMBERS = new RegExp(NUMBER, 'g')

/**
 * The order ECharts 6.1.0 writes a chart's words in, by the kind of word
 * its key names: the value axis's title, the category axis's, the ticks',
 * the categories', the values' series by series, the legend's and the
 * chart's title, each kind in its own order (`chart-svg.test.ts`).
 */
const WRITTEN: readonly string[] = ['valueTitle', 'categoryTitle', 'tick', 'category', 'value', 'legend', 'title']

/** One word a chart prints, in the face it prints in, and the box pdfmake prints it in, in points from the chart's top left. */
export interface PlacedWord extends ChartWord {
  readonly face: ChartFace
  /** The box's left and top, its width the word's advance and its height the face's line. */
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** An element of the drawing as read: its name, its attributes as written, the elements it holds, and a `<text>`'s word as written. */
interface Element {
  readonly name: string
  readonly attributes: ReadonlyMap<string, string>
  readonly children: Element[]
  written: string
}

/** What refuses the drawing of a chart, saying what the drawing does, never quoting it. */
type Refuse = (what: string) => never

/**
 * `svg` held to CHART_DRAWN and returned without its `<text>` elements and
 * without the one `<style>` of hover rules ECharts writes (0058: no word
 * and no stylesheet reaches the converter); its words read back where
 * pdfmake will draw them; `printed` the words this layout prints, each
 * placed once (none of them empty: an empty word prints nothing).
 */
export function readChartSvg(
  svg: string,
  chart: AxisChart | PieChart,
  printed: readonly ChartWord[],
  faces: ChartFaces,
  widths: FaceWidths,
): { readonly svg: string; readonly words: readonly PlacedWord[] } {
  const refuse: Refuse = (what) => {
    throw new RenderRefusal(
      'unsupported',
      `ECharts' drawing of the chart ${chart.id} ${what}: the renderer hands pdfmake's SVG converter only what ECharts 6.1.0 was seen to write, and prints only the words the runtime resolved, each once`,
      chart.id,
    )
  }
  const drawing = parse(svg, refuse)
  hold(drawing, chart, faces, refuse)
  return { svg: serialised(drawing), words: placed(drawing, printed, faces, widths, refuse) }
}

/** `svg` read as markup into its one `<svg>`, each element held to `ELEMENTS`, its one style sheet read and left out: anything but elements, attributes, words and that sheet refused. */
function parse(svg: string, refuse: Refuse): Element {
  const open: Element[] = []
  let root: Element | undefined
  let sheets = 0
  let at = 0
  while (at < svg.length) {
    const next = svg.indexOf('<', at)
    held(open.at(-1), svg.slice(at, next < 0 ? svg.length : next), refuse)
    if (next < 0) break
    at = next
    if (svg.startsWith('<!--', at)) refuse('holds a comment')
    if (svg.startsWith('<![CDATA[', at)) refuse('holds CDATA outside its one style sheet')
    if (svg.startsWith('<!', at)) refuse('holds a DOCTYPE or a declaration')
    if (svg.startsWith('<?', at)) refuse('holds a processing instruction')
    if (svg.startsWith('</', at)) {
      const end = /<\/([A-Za-z][\w:.-]*)>/y
      end.lastIndex = at
      const [, name] = end.exec(svg) ?? refuse('holds markup that is no end tag')
      if (open.pop()?.name !== name) refuse('holds an end tag that ends no element it opened')
      at = end.lastIndex
      continue
    }
    const start = /<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+="[^"]*")*)\s*(\/?)>/y
    start.lastIndex = at
    const [, name = '', written = '', closed = ''] = start.exec(svg) ?? refuse('holds markup that is no element')
    at = start.lastIndex
    const parent = open.at(-1)
    const vocabulary = ELEMENTS.get(name) ?? refuse('holds an element ECharts writes none of')
    const element: Element = { name, attributes: attributesOf(vocabulary, name, written, refuse), children: [], written: '' }
    if (name === 'svg' ? root !== undefined : !vocabulary.inside.has(parent?.name ?? ''))
      refuse(parent === undefined ? 'holds an element outside its <svg>' : `holds an element inside its <${parent.name}>`)
    if (closed !== '') refuse('holds an element closed as it opens')
    if (name === 'style') {
      sheets += 1
      if (sheets > 1) refuse('holds a style sheet but its one of hover rules')
      at = hoverRules(svg, at, refuse)
      continue
    }
    if (parent === undefined) root = element
    else parent.children.push(element)
    open.push(element)
  }
  if (root === undefined || open.length > 0) refuse('holds an element left open, or no <svg>')
  return root
}

/** What stands between two tags, as `parent` holds it: a word inside a `<text>`, and only whitespace anywhere else. */
function held(parent: Element | undefined, between: string, refuse: Refuse): void {
  if (parent?.name === 'text') parent.written = between
  else if (!/^[ \t\r\n]*$/.test(between)) refuse('holds text outside a word')
}

/** The attributes written in `written`, each one `element`, a `name`, is written with, once, of a value it is written with, and none it is read by left out. */
function attributesOf(element: Vocabulary, name: string, written: string, refuse: Refuse): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>()
  for (const [, attribute = '', value = ''] of written.matchAll(/\s+([^\s=]+)="([^"]*)"/g)) {
    const values = element.values.get(attribute) ?? refuse(`holds an attribute ECharts does not write its <${name}> with`)
    if (attributes.has(attribute)) refuse(`holds an attribute written twice on its <${name}>`)
    if (!values.test(value))
      refuse(
        name === 'text' && attribute === 'transform'
          ? 'holds a word turned or scaled'
          : `holds a value ECharts does not write an attribute of its <${name}> with`,
      )
    attributes.set(attribute, value)
  }
  if (element.required.some((attribute) => !attributes.has(attribute))) refuse(`holds its <${name}> without an attribute it is read by`)
  return attributes
}

/**
 * Where the style sheet whose content starts at `at` ends: ECharts writes
 * one, a CDATA section of rules every selector of which ends in `:hover`,
 * which prints nothing and is left out. Any other is refused.
 */
function hoverRules(svg: string, at: number, refuse: Refuse): number {
  const end = svg.indexOf('</style>', at)
  // A selector starts at its first character that is not whitespace, so that each rule is read one way only, and a sheet that does not match fails at once.
  const sheet = /^\s*<!\[CDATA\[((?:\s*[^\s{}<>;@][^{}<>;@]*\{[^{}<>]*\})*)\s*\]\]>\s*$/.exec(svg.slice(at, end))
  if (end < 0 || sheet === null) refuse('holds a style sheet but its one of hover rules')
  const [, rules = ''] = sheet
  for (const [, selectors = ''] of rules.matchAll(/([^{}]+)\{/g))
    if (!selectors.split(',').every((selector) => /\S:hover$/.test(selector.trim()))) refuse('holds a style sheet with a rule but of hovering')
  return end + '</style>'.length
}

/** Whether `element` strokes: a `stroke` written that paints. */
const stroked = ({ attributes }: Element): boolean => !['none', 'transparent', undefined].includes(attributes.get('stroke'))

/** `drawing` held, element by element, to its box, the nesting a PDF/A holds and the colours the option names, each clip to a path it defines once, and what a clip holds to the strokes it cuts nothing of. */
function hold(drawing: Element, chart: AxisChart | PieChart, faces: ChartFaces, refuse: Refuse): void {
  const reach = Math.max(chart.width, chart.height)
  const painted = new Set([...namedColours(chart, faces), 'none', 'transparent'])
  const masks = new Set(['#000', 'none'])
  const clips: string[] = []
  const clipped: string[] = []
  const walk = (element: Element, depth: number, masked: boolean, inClip: boolean): void => {
    // The converter saves the graphics state as it starts, and once for each element it draws inside the one before.
    if (depth + 1 > PDF_A_NESTING) refuse(`holds groups nested deeper than the ${String(PDF_A_NESTING)} graphics states a PDF/A holds`)
    for (const [attribute, value] of element.attributes) {
      const measures = attribute === 'd' ? reached(value) : MEASURES.has(attribute) ? [...value.matchAll(NUMBERS)].map(([number]) => Number(number)) : []
      for (const measure of measures) {
        if (!Number.isFinite(measure)) refuse('holds a number that is not finite')
        if (measure < -reach || measure > 2 * reach)
          refuse(`holds a number past its box by more than its size, ${String(chart.width)} by ${String(chart.height)} points`)
      }
      if ((attribute === 'fill' || attribute === 'stroke') && !(masked ? masks : painted).has(value))
        refuse(masked ? 'paints a clip path' : 'holds a colour the option did not name')
      if (attribute === 'clip-path') clipped.push(value.slice('url(#'.length, -')'.length))
      if (attribute === 'id') clips.push(value)
    }
    if (
      inClip &&
      stroked(element) &&
      !(element.attributes.get('stroke-linejoin') === 'bevel' && (element.attributes.get('stroke-linecap') ?? 'butt') === 'butt')
    )
      refuse('strokes a path inside a clip otherwise than with bevelled joins and butt ends, and the clip is not drawn')
    for (const child of element.children) walk(child, depth + 1, masked || element.name === 'clipPath', inClip || element.attributes.has('clip-path'))
  }
  walk(drawing, 1, false, false)
  const box = [String(chart.width), String(chart.height), `0 0 ${String(chart.width)} ${String(chart.height)}`]
  if (['width', 'height', 'viewBox'].some((attribute, index) => drawing.attributes.get(attribute) !== box[index])) refuse('is of another size than its box')
  if (new Set(clips).size !== clips.length || clipped.some((id) => !clips.includes(id))) refuse('clips by a path it does not define once')
}

/**
 * The measures of `d`, a path held to `VOCABULARY`, as the converter takes
 * them (`pathParts`): each point it moves, draws or curves to -- a
 * relative line's, and never its step, which ECharts takes back across the
 * whole of a title's or a legend's background -- each curve's control
 * points, and an arc's radius, its turn and its flags no measure. The
 * converter draws an arc as curves on the circle through its ends, of its
 * radius or of half the line between them where that is longer, so that
 * every number it writes of one is within a few of the box's sizes when
 * the radius and the ends are held to the box.
 */
function reached(d: string): number[] {
  return pathParts(d).flatMap(({ command, numbers, to }) =>
    command === 'Z' ? [] : [...(command === 'A' ? numbers.slice(0, 1) : numbers.slice(0, -2)).map(Number), ...to],
  )
}

/** A part of a path: where it stands in its `d`, as written; its command and its numbers as written; and the points it runs from and to. */
export interface PathPart {
  readonly index: number
  readonly written: string
  readonly command: string
  readonly numbers: readonly string[]
  readonly from: readonly [number, number]
  readonly to: readonly [number, number]
}

/**
 * The parts of `d`, a path in `VOCABULARY`'s grammar, each from the point
 * the converter takes it from (svg-to-pdfkit's `SvgShape`, `source.js`) to
 * the point it reaches: a relative line's the point before it moved by its
 * step; a close's the one its path last moved to, which the part after it
 * starts from.
 */
export function pathParts(d: string): PathPart[] {
  const parts: PathPart[] = []
  // Never read: a path starts with a move.
  let at: readonly [number, number] = [0, 0]
  let start = at
  for (const { 0: written, 1: command = '', 2: given = '', index } of d.matchAll(/([MLlCQAZ])([^MLlCQAZ]*)/g)) {
    const from = at
    const numbers = command === 'Z' ? [] : given.split(' ')
    const [x = 0, y = 0] = numbers.slice(-2).map(Number)
    at = command === 'Z' ? start : command === 'l' ? [from[0] + x, from[1] + y] : [x, y]
    if (command === 'M') start = at
    parts.push({ index, written, command, numbers, from, to: at })
  }
  return parts
}

/** The colours the option names for `chart` in `faces`: each series' or slice's and each legend entry's, the grid's, the axis's and the words'. */
function namedColours(chart: AxisChart | PieChart, faces: ChartFaces): string[] {
  const marks = chart.chart === 'pie' ? chart.slices.map(({ color }) => color) : chart.series.map(({ color }) => color)
  const words = faces.title === undefined ? [faces.words] : [faces.words, faces.title]
  return [...marks, ...chart.legend.map(({ color }) => color), GRID.color, AXIS.color, ...words.map(({ font }) => font.color)]
}

/** `drawing` as the converter is handed it: every element, attribute and value as read, but its words and every clip, which 6.1.0 writes of a line series alone. */
function serialised({ name, attributes, children }: Element): string {
  const written = [...attributes]
    .filter(([attribute]) => attribute !== 'clip-path')
    .map(([attribute, value]) => ` ${attribute}="${value}"`)
    .join('')
  return `<${name}${written}>${children
    .filter((child) => child.name !== 'text' && child.name !== 'clipPath')
    .map(serialised)
    .join('')}</${name}>`
}

/** Every `<text>` of `element`, in the order the drawing writes them. */
const textsOf = (element: Element): Element[] => (element.name === 'text' ? [element] : element.children.flatMap(textsOf))

/** `word` as zrender's `encodeHTML` writes it (core/dom.js): its & < > " and ' as the five entities, an apostrophe as a numeric reference. */
const escaped = (word: string): string =>
  word.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

/** `written`, a word as zrender writes it, read: the five entities read, the ampersand's last, and refused where it is not what zrender writes of what they read as. */
function wordOf(written: string, refuse: Refuse): string {
  if (/&(?!(?:amp|lt|gt|quot|#39);)/.test(written)) refuse('holds an entity or a character reference but the five zrender writes')
  const word = written.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&')
  if (escaped(word) !== written) refuse('holds a word with a character zrender escapes, unescaped')
  return word
}

/** Whether `text`, a `<text>` held to `ELEMENTS`, is written in `face`. */
function writtenIn(text: Element, { font }: ChartFace): boolean {
  const italic = font.fontStyle === 'italic' ? 'font-style:italic;' : ''
  const bold = font.fontWeight === 'bold' ? 'font-weight:bold;' : ''
  return text.attributes.get('style') === `font-size:${String(font.fontSize)}px;font-family:${font.fontFamily};${italic}${bold}`
}

/**
 * Each of `printed` in the box its `<text>` places it in, in the order
 * `printed` lists them: each `<text>` the first of the words of its text
 * and in its face not yet placed, in the order ECharts writes them.
 */
function placed(drawing: Element, printed: readonly ChartWord[], faces: ChartFaces, widths: FaceWidths, refuse: Refuse): PlacedWord[] {
  const faceOf = (word: ChartWord): ChartFace => {
    const face = word.title ? faces.title : faces.words
    if (face === undefined) throw new Error("a chart's title was read with no face to print it in")
    return face
  }
  const rank = ({ key }: ChartWord): number => WRITTEN.indexOf(key.replace(/\/.*$/, ''))
  const waiting = new Map<string, ChartWord[]>()
  for (const word of [...printed].sort((a, b) => rank(a) - rank(b))) {
    const queue = waiting.get(word.text)
    if (queue === undefined) waiting.set(word.text, [word])
    else queue.push(word)
  }
  const boxes = new Map<ChartWord, PlacedWord>()
  for (const text of textsOf(drawing)) {
    const word = wordOf(text.written, refuse)
    if (word === '') continue
    const queue = waiting.get(word) ?? []
    const index = queue.findIndex((each) => writtenIn(text, faceOf(each)))
    const chosen = index < 0 ? undefined : queue.splice(index, 1)[0]
    if (chosen === undefined) refuse('holds a word the runtime did not resolve, one more often than it did, or one in another face than its own')
    boxes.set(chosen, boxOf(chosen, faceOf(chosen), text, widths))
  }
  const words = printed.flatMap((word) => boxes.get(word) ?? [])
  if (words.length < printed.length) refuse(`leaves out ${String(printed.length - words.length)} of the ${String(printed.length)} words its layout prints`)
  return words
}

/** `word`'s box in `face` as `text` places it: its left by its anchor at its translation and its own x, its top half its line above its line's centre. */
function boxOf(word: ChartWord, face: ChartFace, text: Element, widths: FaceWidths): PlacedWord {
  const [, moveX = '0', moveY = '0'] = /^translate\((\S+) (\S+)\)$/.exec(text.attributes.get('transform') ?? '') ?? []
  const width = widths.width(face.family, face.face, face.size, word.text)
  const anchor = text.attributes.get('text-anchor')
  const left = Number(moveX) + Number(text.attributes.get('x') ?? 0) - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0)
  const centre = Number(moveY) + Number(text.attributes.get('y') ?? 0)
  return { ...word, face, x: left, top: centre - face.line / 2, width, height: face.line }
}
