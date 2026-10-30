/**
 * The shapes an SVG draws with -- path, rect, circle, ellipse, line,
 * polyline, polygon -- their geometry read and written back, and what each
 * costs measured on the commands svg-to-pdfkit builds it from
 * (`source.js:2066-2155`).
 *
 * A shape of no size draws nothing, as SVG says, and is removed: a rect, a
 * circle or an ellipse with a zero side or radius, a path with no data, a
 * polyline of fewer than two points. A negative size is an error SVG does
 * not draw, and is refused. Every length is in user units, its unit
 * converted; a percentage of the viewport is refused, since what the
 * viewport is depends on the report's box.
 */
import { GEOMETRY } from './svg-allow.js'
import { type SvgNumber, writeNumber, ZERO } from './svg-number.js'
import { type Drawn, type FloatCommand, floats, isBlank, measure, readPath, writePath } from './svg-path.js'
import { refuse } from './svg-refusal.js'
import type { SvgElement } from './svg-tree.js'
import { readLength, readNumbers } from './svg-values.js'

export interface Shape {
  readonly geometry: ReadonlyArray<readonly [string, string]>
  readonly drawn: Drawn
}

/** The shape's geometry and cost, or undefined when it draws nothing. */
export function readShape(element: SvgElement): Shape | undefined {
  const lengths = new Map<string, SvgNumber>()
  const geometry: Array<readonly [string, string]> = []
  for (const name of GEOMETRY[element.name]) {
    const attribute = element.attributes.get(name)
    if (attribute === undefined) continue
    if (name === 'd' || name === 'points') continue
    const length = readLength(attribute.value, attribute.where, false)
    if (['width', 'height', 'r', 'rx', 'ry'].includes(name) && length.value < 0)
      refuse('out-of-range', `${attribute.where} is negative`, 'give it zero or more')
    lengths.set(name, length)
    geometry.push([name, writeNumber(length)])
  }
  const at = (name: string): number => (lengths.get(name) ?? ZERO).value
  const commands = shapeCommands(element, at, lengths)
  if (commands === undefined) return undefined
  if (element.name === 'path') geometry.push(['d', writePath(commands.path ?? [])])
  if (element.name === 'polyline' || element.name === 'polygon') geometry.push(['points', commands.points ?? ''])
  return { geometry, drawn: measure(commands.floats) }
}

interface Commands {
  readonly floats: readonly FloatCommand[]
  readonly path?: ReturnType<typeof readPath>
  readonly points?: string
}

function move(x: number, y: number): FloatCommand {
  return { letter: 'M', values: [x, y] }
}

function line(x: number, y: number): FloatCommand {
  return { letter: 'L', values: [x, y] }
}

function arc(rx: number, ry: number, x: number, y: number): FloatCommand {
  return { letter: 'A', values: [rx, ry, 0, 0, 1, x, y] }
}

const CLOSE: FloatCommand = { letter: 'Z', values: [] }

/** The commands the converter builds the shape from, or undefined when it draws nothing. */
function shapeCommands(element: SvgElement, at: (name: string) => number, lengths: ReadonlyMap<string, SvgNumber>): Commands | undefined {
  switch (element.name) {
    case 'path': {
      const d = element.attributes.get('d')
      if (d === undefined || isBlank(d.value)) return undefined
      const path = readPath(d.value, d.where)
      return { floats: floats(path), path }
    }
    case 'rect':
      return rect(at('x'), at('y'), at('width'), at('height'), lengths.get('rx')?.value, lengths.get('ry')?.value)
    case 'circle': {
      const [cx, cy, r] = [at('cx'), at('cy'), at('r')]
      return r > 0 ? { floats: [move(cx + r, cy), arc(r, r, cx - r, cy), arc(r, r, cx + r, cy), CLOSE] } : undefined
    }
    case 'ellipse': {
      const [cx, cy, rx, ry] = [at('cx'), at('cy'), at('rx'), at('ry')]
      return rx > 0 && ry > 0 ? { floats: [move(cx + rx, cy), arc(rx, ry, cx - rx, cy), arc(rx, ry, cx + rx, cy), CLOSE] } : undefined
    }
    case 'line':
      return { floats: [move(at('x1'), at('y1')), line(at('x2'), at('y2'))] }
    default:
      return poly(element)
  }
}

/** A rect as the converter builds it: rounded when it has a radius, one radius standing for both, each at most half its side. */
function rect(x: number, y: number, w: number, h: number, rxIn: number | undefined, ryIn: number | undefined): Commands | undefined {
  if (!(w > 0 && h > 0)) return undefined
  let rx = rxIn ?? ryIn ?? 0
  let ry = ryIn ?? rxIn ?? 0
  if (rx === 0 || ry === 0) return { floats: [move(x, y), line(x + w, y), line(x + w, y + h), line(x, y + h), CLOSE] }
  rx = Math.min(rx, 0.5 * w)
  ry = Math.min(ry, 0.5 * h)
  return {
    floats: [
      move(x + rx, y),
      line(x + w - rx, y),
      arc(rx, ry, x + w, y + ry),
      line(x + w, y + h - ry),
      arc(rx, ry, x + w - rx, y + h),
      line(x + rx, y + h),
      arc(rx, ry, x, y + h - ry),
      line(x, y + ry),
      arc(rx, ry, x + rx, y),
      CLOSE,
    ],
  }
}

/** A polyline or a polygon: pairs of numbers, a polygon closed; an odd count refused, as the converter would warn of it. */
function poly(element: SvgElement): Commands | undefined {
  const points = element.attributes.get('points')
  if (points === undefined) return undefined
  const numbers = readNumbers(points.value, points.where)
  if (numbers.length % 2 === 1) refuse('unsupported', `${points.where} holds an odd count of coordinates`, 'give every point both of its coordinates')
  if (numbers.length < 4) return undefined
  const commands: FloatCommand[] = []
  for (let i = 0; i < numbers.length; i += 2) {
    const x = (numbers[i] as SvgNumber).value
    const y = (numbers[i + 1] as SvgNumber).value
    commands.push(i === 0 ? move(x, y) : line(x, y))
  }
  if (element.name === 'polygon') commands.push(CLOSE)
  return { floats: commands, points: numbers.map(writeNumber).join(' ') }
}
