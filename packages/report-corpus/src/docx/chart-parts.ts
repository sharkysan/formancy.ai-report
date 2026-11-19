import type { DocxBorder, DocxChartFace, DocxChartWord } from './model.js'
import { NS } from './vocabulary.js'
import { child, type XmlNode } from './xml.js'

/**
 * What every reading of a chart's part shares (0076): how an element's
 * one value is read and held, a shape's paints, and a word with what it
 * is set in. Each refusal names the part. The series are read by
 * `chart-series.ts`, the axes by `chart-axes.ts`, and the chart itself by
 * `chart.ts`.
 */

/** A decimal as the runtime writes one: a minus or none, digits, and a point and digits or none. */
const DECIMAL = /^-?\d+(?:\.\d+)?$/

/** English Metric Units to the point. */
const EMU = 12700

/** The reading of one chart's part: its refusals name the part. */
export interface ChartReading {
  readonly fail: (message: string) => never
  /** The child of `node` named `local` in the chart's namespace, and in DrawingML's own. */
  readonly c: (node: XmlNode, local: string) => XmlNode | undefined
  readonly a: (node: XmlNode, local: string) => XmlNode | undefined
  readonly need: (node: XmlNode, local: string) => XmlNode
  /** The `val` of the child `local` of `node`. */
  readonly stated: (node: XmlNode, local: string) => string
  /** Holds each child of `node` to the one value a report's chart states for it. */
  readonly fixed: (node: XmlNode, values: Readonly<Record<string, string>>) => void
  readonly whole: (node: XmlNode, local: string, written?: string) => number
  readonly decimal: (written: string, what: string) => string
}

export function chartReading(name: string): ChartReading {
  const fail = (message: string): never => {
    throw new Error(`${name}: ${message}`)
  }
  const c: ChartReading['c'] = (node, local) => child(node, NS.c, local)
  const need: ChartReading['need'] = (node, local) => c(node, local) ?? fail(`${node.local} holds no ${local}`)
  const stated: ChartReading['stated'] = (node, local) => need(node, local).attributes.get('val') ?? fail(`${local} states no value`)
  return {
    fail,
    c,
    a: (node, local) => child(node, NS.a, local),
    need,
    stated,
    fixed: (node, values) => {
      for (const [local, value] of Object.entries(values)) {
        const read = stated(node, local)
        if (read !== value) fail(`${node.local} states ${local} as '${read}', where a report's chart states '${value}'`)
      }
    },
    whole: (node, local, written = stated(node, local)) => {
      if (!/^-?\d+$/.test(written)) fail(`${node.local} states ${local} as '${written}', which is no whole number`)
      return Number(written)
    },
    decimal: (written, what) => (DECIMAL.test(written) ? written : fail(`${what} is '${written}', which is no decimal`)),
  }
}

/** A colour as the document writes one, from the six hex digits of a solid fill. */
export function colour({ a, fail }: ChartReading, node: XmlNode | undefined, of: string): string {
  const written = node === undefined ? undefined : a(node, 'srgbClr')?.attributes.get('val')
  if (written === undefined || !/^[0-9A-Fa-f]{6}$/.test(written)) return fail(`${of} names the colour '${String(written)}', which is not six hex digits`)
  return `#${written.toLowerCase()}`
}

/** A shape's line: none, or one of a weight in a colour. A shape that states no line leaves it to Word, and is refused. */
export function line(reading: ChartReading, shape: XmlNode | undefined, of: string): DocxBorder | undefined {
  const { a, fail, whole } = reading
  const ln = shape === undefined ? undefined : a(shape, 'ln')
  if (ln === undefined) return fail(`${of} states no line, which Word then draws as it likes`)
  if (a(ln, 'noFill') !== undefined) return ln.attributes.has('w') || a(ln, 'solidFill') !== undefined ? fail(`${of} has a line both drawn and not`) : undefined
  return { weight: whole(ln, 'w', ln.attributes.get('w') ?? fail(`${of} has a line of no weight`)) / EMU, color: colour(reading, a(ln, 'solidFill'), of) }
}

/** A shape filled in one colour, with no line around it. */
export function filled(reading: ChartReading, shape: XmlNode | undefined, of: string): string {
  const { a, fail } = reading
  if (shape === undefined || a(shape, 'noFill') !== undefined || line(reading, shape, of) !== undefined)
    return fail(`${of} is not filled in one colour with no line around it`)
  return colour(reading, a(shape, 'solidFill'), of)
}

/** A shape that paints nothing: no fill, and a line stated as none. */
export function unpainted(reading: ChartReading, shape: XmlNode | undefined, of: string): void {
  const { a, fail } = reading
  if (shape === undefined || a(shape, 'noFill') === undefined || a(shape, 'solidFill') !== undefined) return fail(`${of} is filled, or left for Word to fill`)
  if (line(reading, shape, of) !== undefined) fail(`${of} has a line around it`)
}

/** Held across: without it Word may turn a word. */
function across({ a, fail }: ChartReading, holder: XmlNode, of: string): void {
  const body = a(holder, 'bodyPr')
  if (body?.attributes.get('rot') !== '0' || body.attributes.get('vert') !== 'horz') fail(`${of} is not held across: Word may turn it`)
}

function face(reading: ChartReading, set: XmlNode | undefined, of: string): DocxChartFace {
  const { a, fail, whole } = reading
  if (set === undefined) return fail(`${of} states nothing of what it is set in`)
  const [size, bold, italic] = ['sz', 'b', 'i'].map((key) => set.attributes.get(key) ?? fail(`${of} states no ${key}`))
  const families = ['latin', 'ea', 'cs'].map((slot) => a(set, slot)?.attributes.get('typeface'))
  if (families[0] === undefined || families.some((family) => family !== families[0])) return fail(`${of} names its three typeface slots otherwise than alike`)
  if ([bold, italic].some((flag) => flag !== '0' && flag !== '1')) fail(`${of} states its weight or its slant as neither 0 nor 1`)
  return {
    family: families[0],
    size: whole(set, 'sz', size) / 100,
    bold: bold === '1',
    italic: italic === '1',
    color: colour(reading, a(set, 'solidFill'), of),
  }
}

/** What the words Word writes itself are set in. */
export function defaults(reading: ChartReading, holder: XmlNode, of: string): DocxChartFace {
  const { a, need } = reading
  const set = need(holder, 'txPr')
  across(reading, set, of)
  const paragraph = a(set, 'p')
  const properties = paragraph === undefined ? undefined : a(paragraph, 'pPr')
  return face(reading, properties === undefined ? undefined : a(properties, 'defRPr'), of)
}

/** A word the part states: one run of one paragraph. */
export function word(reading: ChartReading, holder: XmlNode, of: string): DocxChartWord {
  const { a, c, fail, need } = reading
  const rich = c(need(holder, 'tx'), 'rich') ?? fail(`${of} is no word of the file's own`)
  across(reading, rich, of)
  const paragraph = a(rich, 'p')
  const run = paragraph === undefined ? undefined : a(paragraph, 'r')
  const text = run === undefined ? undefined : a(run, 't')
  if (run === undefined || text === undefined) return fail(`${of} holds no text`)
  return { text: text.text, face: face(reading, a(run, 'rPr'), of) }
}

/** The title `holder` has, beside what it titles and never over it; none where it has none. */
export function titled(reading: ChartReading, holder: XmlNode, of: string): { readonly title?: DocxChartWord } {
  const title = reading.c(holder, 'title')
  if (title === undefined) return {}
  reading.fixed(title, { overlay: '0' })
  return { title: word(reading, title, of) }
}
