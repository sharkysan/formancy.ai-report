/**
 * Path data: read by SVG's path grammar, written back as absolute commands,
 * and measured as svg-to-pdfkit will draw it.
 *
 * Read with implicit repetition and the compact arc flags (`a1 1 0 00 1 1`).
 * Malformed data is refused whole: SVG would draw up to the error, and a
 * path that would draw only partly is not drawn here at all. Written as
 * absolute commands, one letter each, numbers separated by single spaces,
 * with no implicit repetition; `H`, `V`, `S` and `T` stay what they are, and
 * an arc keeps its radii, its rotation and its flags. Relative steps sum
 * exactly (`svg-number.ts`).
 *
 * What a path costs is measured on the commands the converter draws, by
 * the converter's own construction: a move, a line and a close each one
 * command, a curve one, an arc one curve per 60 degrees it sweeps at
 * svg-to-pdfkit's default precision, or a line when a radius is zero or
 * when it ends where it starts, which draws nothing but is still read. The
 * basic shapes are measured as the converter builds them: an arc's split at
 * `source.js:1054`, its precision at `:2628`, the shapes at `:2066-2155`.
 */
import { plus, scanNumber, numberAt, type SvgNumber, writeNumber, ZERO } from './svg-number.js'
import { refuse } from './svg-refusal.js'
import { isSpace, skipSpace } from './svg-values.js'

export type PathLetter = 'M' | 'L' | 'H' | 'V' | 'C' | 'S' | 'Q' | 'T' | 'A' | 'Z'

export interface PathCommand {
  readonly letter: PathLetter
  /** Absolute; for an arc, its radii, rotation and end point, the flags apart. */
  readonly numbers: readonly SvgNumber[]
  readonly flags?: readonly [0 | 1, 0 | 1]
}

const ARGUMENTS: { readonly [L in PathLetter]: number } = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

const LETTERS: ReadonlySet<string> = new Set(Object.keys(ARGUMENTS))

function letterAt(text: string, i: number): PathLetter | undefined {
  const upper = text.charAt(i).toUpperCase()
  return LETTERS.has(upper) ? (upper as PathLetter) : undefined
}

/** A path's commands, absolute; refused whole when the data is malformed, and empty for data with no command. */
export function readPath(d: string, where: string): readonly PathCommand[] {
  const reader = new PathReader(d, where)
  return reader.read()
}

class PathReader {
  private readonly text: string
  private readonly where: string
  private i = 0
  private x: SvgNumber = ZERO
  private y: SvgNumber = ZERO
  private startX: SvgNumber = ZERO
  private startY: SvgNumber = ZERO
  private readonly commands: PathCommand[] = []

  constructor(text: string, where: string) {
    this.text = text
    this.where = where
  }

  read(): readonly PathCommand[] {
    this.i = skipSpace(this.text, 0)
    if (this.i >= this.text.length) return this.commands
    if (letterAt(this.text, this.i) !== 'M') this.malformed()
    while (this.i < this.text.length) {
      const letter = letterAt(this.text, this.i)
      if (letter === undefined) this.malformed()
      const relative = this.text.charAt(this.i) !== letter
      this.i = skipSpace(this.text, this.i + 1)
      if (letter === 'Z') {
        this.commands.push({ letter: 'Z', numbers: [] })
        this.x = this.startX
        this.y = this.startY
        continue
      }
      let repeated: PathLetter = letter
      for (;;) {
        this.group(repeated, relative)
        // After a move, a repeated pair is a line (SVG 1.1, 8.3.2).
        if (repeated === 'M') repeated = 'L'
        this.i = skipSpace(this.text, this.i)
        if (this.text.charCodeAt(this.i) === 0x2c) {
          this.i = skipSpace(this.text, this.i + 1)
          if (scanNumber(this.text, this.i) < 0) this.malformed()
          continue
        }
        // A number straight after the last, with or without a space, repeats the command.
        if (scanNumber(this.text, this.i) < 0) break
      }
    }
    return this.commands
  }

  private malformed(): never {
    return refuse('unsupported', `${this.where} is malformed path data`, 'save the drawing again from the program it was made in')
  }

  private number(): SvgNumber {
    const end = scanNumber(this.text, this.i)
    if (end < 0) this.malformed()
    const n = numberAt(this.text, this.i, end, this.where)
    this.i = end
    return n
  }

  /** A separator between two arguments: optional whitespace, then an optional comma and whitespace. */
  private separator(): void {
    this.i = skipSpace(this.text, this.i)
    if (this.text.charCodeAt(this.i) === 0x2c) this.i = skipSpace(this.text, this.i + 1)
  }

  private flag(): 0 | 1 {
    const code = this.text.charCodeAt(this.i)
    if (code !== 0x30 && code !== 0x31) this.malformed()
    this.i += 1
    return code === 0x30 ? 0 : 1
  }

  private absolute(n: SvgNumber, from: SvgNumber, relative: boolean): SvgNumber {
    return relative ? plus(from, n, this.where) : n
  }

  /** One command's arguments, read, made absolute and pushed. */
  private group(letter: PathLetter, relative: boolean): void {
    const args: SvgNumber[] = []
    let flags: [0 | 1, 0 | 1] | undefined
    for (let k = 0; k < ARGUMENTS[letter]; k += 1) {
      if (k > 0) this.separator()
      if (letter === 'A' && (k === 3 || k === 4)) {
        flags ??= [0, 0]
        flags[k - 3] = this.flag()
        continue
      }
      args.push(this.number())
    }
    const { x, y } = this
    let numbers: SvgNumber[]
    switch (letter) {
      case 'H':
        numbers = [this.absolute(args[0] as SvgNumber, x, relative)]
        this.x = numbers[0] as SvgNumber
        break
      case 'V':
        numbers = [this.absolute(args[0] as SvgNumber, y, relative)]
        this.y = numbers[0] as SvgNumber
        break
      case 'A':
        numbers = [args[0], args[1], args[2], this.absolute(args[3] as SvgNumber, x, relative), this.absolute(args[4] as SvgNumber, y, relative)] as SvgNumber[]
        this.x = numbers[3] as SvgNumber
        this.y = numbers[4] as SvgNumber
        break
      default:
        numbers = args.map((n, k) => this.absolute(n, k % 2 === 0 ? x : y, relative))
        this.x = numbers[numbers.length - 2] as SvgNumber
        this.y = numbers[numbers.length - 1] as SvgNumber
    }
    if (letter === 'M') {
      this.startX = this.x
      this.startY = this.y
    }
    this.commands.push(flags === undefined ? { letter, numbers } : { letter, numbers, flags })
  }
}

/** The path data a cleaned drawing holds. */
export function writePath(commands: readonly PathCommand[]): string {
  return commands
    .map(({ letter, numbers, flags }) => {
      if (letter === 'A' && flags !== undefined) {
        const [rx, ry, rotation, x, y] = numbers.map(writeNumber)
        return `A${rx} ${ry} ${rotation} ${flags[0]} ${flags[1]} ${x} ${y}`
      }
      return `${letter}${numbers.map(writeNumber).join(' ')}`
    })
    .join(' ')
}

/** What drawing a shape costs: the commands the converter draws, by kind, and a bound on the length of the outline, which dashes are laid along. */
export interface Drawn {
  moves: number
  lines: number
  curves: number
  length: number
  /** A box the outline lies inside, in the shape's own coordinates -- left, top, right, bottom -- which its box in a browser's or the converter's sense lies inside too: what a gradient in its box is scaled to. */
  box: [number, number, number, number]
}

function nothingDrawn(): Drawn {
  return { moves: 0, lines: 0, curves: 0, length: 0, box: [Infinity, Infinity, -Infinity, -Infinity] }
}

/** The box widened to hold the point, or a square of `reach` about it. */
function hold(box: Drawn['box'], x: number, y: number, reach = 0): void {
  box[0] = Math.min(box[0], x - reach)
  box[1] = Math.min(box[1], y - reach)
  box[2] = Math.max(box[2], x + reach)
  box[3] = Math.max(box[3], y + reach)
}

/** A command as the converter receives it: absolute, in floats; an arc's flags are its fourth and fifth numbers. */
export interface FloatCommand {
  readonly letter: PathLetter
  readonly values: readonly number[]
}

export function floats(commands: readonly PathCommand[]): FloatCommand[] {
  return commands.map(({ letter, numbers, flags }) => {
    const values = numbers.map((n) => n.value)
    if (letter === 'A' && flags !== undefined) values.splice(3, 0, flags[0], flags[1])
    return { letter, values }
  })
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}

/**
 * What the converter draws for these commands, replaying its own
 * construction (`SvgShape`, `source.js:925-1100`): `S` reflects the last
 * curve's control point only after a `C` or an `S`, `T` the last quadratic's
 * only after a `Q` or a `T`, and an arc is split as the converter splits it.
 * The length is the control polygon's, which is never shorter than the
 * curve, so a count of dashes laid along it is an upper bound.
 */
export function measure(commands: readonly FloatCommand[]): Drawn {
  const drawn = nothingDrawn()
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let last: PathLetter | undefined
  let controlX = 0
  let controlY = 0
  // A curve lies inside the hull of its control points, so the box holds them all.
  const curve = (c1x: number, c1y: number, c2x: number, c2y: number, ex: number, ey: number): void => {
    drawn.curves += 1
    drawn.length += distance(x, y, c1x, c1y) + distance(c1x, c1y, c2x, c2y) + distance(c2x, c2y, ex, ey)
    hold(drawn.box, c1x, c1y)
    hold(drawn.box, c2x, c2y)
    hold(drawn.box, ex, ey)
    x = ex
    y = ey
  }
  const line = (ex: number, ey: number): void => {
    drawn.lines += 1
    drawn.length += distance(x, y, ex, ey)
    hold(drawn.box, ex, ey)
    x = ex
    y = ey
  }
  for (const { letter, values: v } of commands) {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0] = v
    switch (letter) {
      case 'M':
        drawn.moves += 1
        x = startX = a
        y = startY = b
        hold(drawn.box, a, b)
        break
      case 'L':
        line(a, b)
        break
      case 'H':
        line(a, y)
        break
      case 'V':
        line(x, a)
        break
      case 'Z':
        line(startX, startY)
        break
      case 'C':
        curve(a, b, c, d, e, f)
        controlX = c
        controlY = d
        break
      case 'S': {
        const reflect = last === 'C' || last === 'S'
        const [c1x, c1y] = reflect ? [2 * x - controlX, 2 * y - controlY] : [x, y]
        curve(c1x, c1y, a, b, c, d)
        controlX = a
        controlY = b
        break
      }
      case 'Q':
      case 'T': {
        const reflect = letter === 'T' && (last === 'Q' || last === 'T')
        const [qx, qy] = letter === 'Q' ? [a, b] : reflect ? [2 * x - controlX, 2 * y - controlY] : [x, y]
        const [ex, ey] = letter === 'Q' ? [c, d] : [a, b]
        curve(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey)
        controlX = qx
        controlY = qy
        break
      }
      default:
        arc(drawn, x, y, a, b, c, d, e, f, g)
        x = f
        y = g
    }
    last = letter
  }
  return drawn
}

/** The converter's precision: one curve per π / 3 of an arc's sweep (`source.js:2628`; pdfmake passes none). */
const PRECISION = 3

/**
 * How far from an arc's centre, in its larger radius, the converter's
 * curves for it reach: each curve spans at most π / `PRECISION`, and its
 * control points stand off the ellipse along its tangents by 4/3 of the
 * tangent of a quarter of that (`source.js:1058-1062`), so within
 * hypot(1, 4/3 × tan(π / 12)), 1.0619, of the centre; a curve lies inside
 * the hull of its control points.
 */
const CONTROL = Math.hypot(1, (4 / 3) * Math.tan(Math.PI / (4 * PRECISION)))

/**
 * An arc as svg-to-pdfkit splits it (`source.js:1026-1068`), its arithmetic
 * repeated term for term, so that the count is the converter's to the
 * floating-point rounding: a curve per π / 3 swept, a line when a radius is
 * zero. One that ends where it starts draws nothing, and is counted a line
 * all the same: every command is read and written back by every reader of
 * the file, so a path of a mebibyte of arcs that draw nothing is not free.
 * The length bound is the sweep times the larger radius, which the arc is
 * never longer than. The box holds the circle of `CONTROL` times the
 * larger radius about the centre, as the converter grows the radii to
 * reach both ends, which holds every curve it draws: the circle of the
 * ellipse's diameter about its end did not, the curves bulging past the
 * ellipse by a hundred-thousandth of its radius.
 */
function arc(drawn: Drawn, x0: number, y0: number, rxIn: number, ryIn: number, rotation: number, large: number, sweep: number, x: number, y: number): void {
  hold(drawn.box, x, y)
  if (Math.abs(rxIn) < 1e-10 || Math.abs(ryIn) < 1e-10) {
    drawn.lines += 1
    drawn.length += distance(x0, y0, x, y)
    return
  }
  const fi = rotation * (Math.PI / 180)
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  const fa = 1 * Number(!!large)
  const fs = 1 * Number(!!sweep)
  const x1 = (Math.cos(fi) * (x0 - x)) / 2 + (Math.sin(fi) * (y0 - y)) / 2
  const y1 = (Math.cos(fi) * (y0 - y)) / 2 - (Math.sin(fi) * (x0 - x)) / 2
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const r = Math.sqrt(Math.max(0, rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1))
  const x2 = ((fa === fs ? -1 : 1) * r * rx * y1) / ry
  const y2 = ((fa === fs ? 1 : -1) * r * ry * x1) / rx
  const cx = Math.cos(fi) * x2 - Math.sin(fi) * y2 + (x0 + x) / 2
  const cy = Math.sin(fi) * x2 + Math.cos(fi) * y2 + (y0 + y) / 2
  const th1 = Math.atan2((y1 - y2) / ry, (x1 - x2) / rx)
  let th2 = Math.atan2((-y1 - y2) / ry, (-x1 - x2) / rx)
  if (fs === 0 && th2 - th1 > 0) th2 -= 2 * Math.PI
  else if (fs === 1 && th2 - th1 < 0) th2 += 2 * Math.PI
  const curves = Math.ceil(Math.abs(th2 - th1) / (Math.PI / PRECISION))
  // NaN when the arc ends where it starts: the converter's loop draws nothing then, but the arc is read.
  if (!(curves > 0)) {
    drawn.lines += 1
    return
  }
  drawn.curves += curves
  drawn.length += Math.abs(th2 - th1) * Math.max(rx, ry)
  hold(drawn.box, cx, cy, CONTROL * Math.max(rx, ry))
}

/** Whitespace-only path data draws nothing, as an absent `d` does. */
export function isBlank(d: string): boolean {
  for (let i = 0; i < d.length; i += 1) if (!isSpace(d.charCodeAt(i))) return false
  return true
}
