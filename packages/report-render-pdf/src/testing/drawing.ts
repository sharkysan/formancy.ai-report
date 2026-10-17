import { inflateSync } from 'node:zlib'

/**
 * What a page draws besides its text's words and its images' boxes, read
 * from the PDF's own content streams: the lines and rectangles it strokes
 * and fills, with their colour and weight and which of them were painted
 * together, the clips it sets, and the colour and font each run of text is
 * shown in. The corpus's reader sees text and
 * images through PDF.js and nothing drawn as a vector path (0003), which is
 * what a rule, a rectangle and a section's frame are.
 *
 * It reads PDFs as PDFKit writes them, and only those: every object written
 * out plainly with no object streams, one Flate-compressed content stream
 * per page, colours set as DeviceRGB. Anything else fails loudly rather than
 * being read wrongly. Positions are in points down from the page's top edge
 * and in from its left, as the corpus's reader gives them.
 */

/** One subpath of a path the page paints: a rectangle (`re`), or lines and curves from a point (`m`, `l`, `c`). */
export interface Shape {
  readonly kind: 'rect' | 'line'
  /** The box of the path itself, before any stroke's width. */
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
  /** `#rrggbb`; absent when the path is not filled, or not stroked. */
  readonly fill?: string
  readonly stroke?: string
  readonly lineWidth: number
  /** Which painting operator on the page drew it, from 0: shapes with the same number were one path, filled or stroked at once. */
  readonly paint: number
  /**
   * Its points in the order the path gives them, on the page: a
   * rectangle's two opposite corners, or each point its lines and curves
   * end at. A curve's control points are not among them, and its box is
   * theirs: a circle drawn in quarters, as PDFKit and SVG draw one, ends
   * a curve at each of its four extremes.
   */
  readonly points: readonly (readonly [number, number])[]
}

export interface Shown {
  /** Where the run starts, on its baseline. */
  readonly x: number
  readonly baseline: number
  readonly color: string
  /** The font's name in the PDF, without its subset prefix. */
  readonly font: string
  readonly size: number
}

export interface DrawnPage {
  readonly number: number
  readonly shapes: readonly Shape[]
  /** Rectangles set as clipping paths. */
  readonly clips: readonly Omit<Shape, 'fill' | 'stroke' | 'lineWidth' | 'paint' | 'points'>[]
  readonly text: readonly Shown[]
}

type Matrix = readonly [number, number, number, number, number, number]

/** `m` applied first, then `n`. */
function multiply(m: Matrix, n: Matrix): Matrix {
  return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

const hex = (channel: number): string =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, '0')

export function readDrawing(bytes: Uint8Array): DrawnPage[] {
  const text = Buffer.from(bytes).toString('latin1')
  if (text.includes('/Type /ObjStm')) throw new Error('the PDF has object streams, which this reader does not read')
  const object = (number: string): string => {
    const start = text.search(new RegExp(`(?:^|\\n)${number} 0 obj\\n`))
    if (start < 0) throw new Error(`the PDF has no object ${number}`)
    return text.slice(start, text.indexOf('\nendobj', start + 1))
  }
  const kids = /\/Type \/Pages[\s\S]*?\/Kids \[([^\]]*)\]/.exec(text)?.[1]
  if (kids === undefined) throw new Error('the PDF has no page tree')
  return [...kids.matchAll(/(\d+) 0 R/g)].map(([, number], index) => {
    const page = object(number!)
    const height = Number(/\/MediaBox \[0 0 [\d.]+ ([\d.]+)\]/.exec(page)?.[1])
    const contents = object(/\/Contents (\d+) 0 R/.exec(page)![1]!)
    const stream = contents.slice(contents.indexOf('stream\n') + 7, contents.lastIndexOf('\nendstream'))
    const resources = object(/\/Resources (\d+) 0 R/.exec(page)![1]!)
    const fonts = new Map([...(/\/Font <<([^>]*)>>/.exec(resources)?.[1] ?? '').matchAll(/\/(\S+) (\d+) 0 R/g)].map(([, name, ref]) => [name!, /\/BaseFont \/(?:[A-Z]{6}\+)?(\S+)/.exec(object(ref!))![1]!]))
    return { number: index + 1, ...interpret(inflateSync(Buffer.from(stream, 'latin1')).toString('latin1'), height, fonts) }
  })
}

const TOKEN = /\/[^\s/[\]()<>]+|<[0-9a-fA-F\s]*>|\((?:\\.|[^\\)])*\)|\[|\]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|[A-Za-z'"*]+/g

interface State {
  ctm: Matrix
  fill: string
  stroke: string
  lineWidth: number
}

function interpret(content: string, height: number, fonts: ReadonlyMap<string, string>): Omit<DrawnPage, 'number'> {
  const shapes: Shape[] = []
  const clips: Omit<Shape, 'fill' | 'stroke' | 'lineWidth' | 'paint' | 'points'>[] = []
  const shown: Shown[] = []
  const stack: State[] = []
  let state: State = { ctm: [1, 0, 0, 1, 0, 0], fill: '#000000', stroke: '#000000', lineWidth: 1 }
  let path: { kind: 'rect' | 'line'; points: [number, number][] }[] = []
  let clip = false
  let paints = 0
  let textMatrix: Matrix = [1, 0, 0, 1, 0, 0]
  let font = { name: '', size: 0 }
  let operands: string[] = []
  const numbers = (count: number): number[] => operands.slice(-count).map(Number)
  const paint = (fill: boolean, stroke: boolean): void => {
    for (const each of path) {
      const xs = each.points.map(([x]) => x)
      const ys = each.points.map(([, y]) => height - y)
      const box = { kind: each.kind, x: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
      if (clip) clips.push(box)
      const points = each.points.map(([x, y]) => [x, height - y] as const)
      if (fill || stroke) shapes.push({ ...box, ...(fill ? { fill: state.fill } : {}), ...(stroke ? { stroke: state.stroke } : {}), lineWidth: state.lineWidth, paint: paints, points })
    }
    if (fill || stroke) paints++
    path = []
    clip = false
  }
  for (const [token] of content.matchAll(TOKEN)) {
    if (/^[A-Za-z'"*]+$/.test(token) && token !== 'true' && token !== 'false') {
      switch (token) {
        case 'q':
          stack.push({ ...state })
          break
        case 'Q':
          state = stack.pop() ?? state
          break
        case 'cm':
          state.ctm = multiply(numbers(6) as unknown as Matrix, state.ctm)
          break
        case 'w':
          state.lineWidth = numbers(1)[0]!
          break
        case 'scn':
        case 'rg':
          state.fill = `#${numbers(3).map(hex).join('')}`
          break
        case 'SCN':
        case 'RG':
          state.stroke = `#${numbers(3).map(hex).join('')}`
          break
        case 're': {
          const [x, y, w, h] = numbers(4) as [number, number, number, number]
          path.push({ kind: 'rect', points: [apply(state.ctm, x, y), apply(state.ctm, x + w, y + h)] })
          break
        }
        case 'm':
          path.push({ kind: 'line', points: [apply(state.ctm, ...(numbers(2) as [number, number]))] })
          break
        case 'l':
        case 'c':
          path.at(-1)?.points.push(apply(state.ctm, ...(numbers(2) as [number, number])))
          break
        case 'W':
        case 'W*':
          clip = true
          break
        case 'S':
          paint(false, true)
          break
        case 'f':
        case 'F':
        case 'f*':
          paint(true, false)
          break
        case 'B':
        case 'B*':
          paint(true, true)
          break
        case 'n':
          paint(false, false)
          break
        case 'BT':
          textMatrix = [1, 0, 0, 1, 0, 0]
          break
        case 'Tm':
          textMatrix = numbers(6) as unknown as Matrix
          break
        case 'Tf':
          font = { name: fonts.get(operands.at(-2)!.slice(1)) ?? operands.at(-2)!, size: Number(operands.at(-1)) }
          break
        case 'Tj':
        case 'TJ': {
          const [x, y] = apply(multiply(textMatrix, state.ctm), 0, 0)
          shown.push({ x, baseline: height - y, color: state.fill, font: font.name, size: font.size })
          break
        }
      }
      operands = []
    } else if (token !== '[' && token !== ']') {
      operands.push(token)
    }
  }
  return { shapes, clips, text: shown }
}
