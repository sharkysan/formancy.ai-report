/**
 * What a cleaned drawing costs to draw, counted on what svg-to-pdfkit will
 * draw for it and what a reader will then paint, and refused past the
 * bounds `limits.ts` measured (0030).
 *
 * The converter does more than the drawing's size says. It draws a clip
 * path again for every element that refers to it, writes a gradient again
 * for every shape painted with it, and makes every clip, every group with
 * an opacity under 1 and every translucent gradient a transparency group
 * the size of the page (`source.js:67-88`, `1493-1537`, `1846-1937`;
 * PDFKit's `pdfkit.js:1026`). So segments count each clip path once per
 * reference and each gradient's stops once per use, and the groups have a
 * bound of their own.
 *
 * The weights are a reader's, measured in limits.ts. `drawn` is what the
 * converter draws each time it draws the drawing, by kind, unweighted: the
 * renderer weights it for its own budget, counting every page a page
 * region draws it on. `extent` is gathered by the same walk, where it
 * decides what the converter draws (`svg-extent.ts`).
 */
import { MAX_SVG_DEPTH, MAX_SVG_ELEMENTS, MAX_SVG_GROUPS, MAX_SVG_SEGMENTS } from './limits.js'
import { SHAPES } from './svg-allow.js'
import type { Drawing, Written } from './svg-drawing.js'
import { Extent, type SvgExtent } from './svg-extent.js'
import { refuse } from './svg-refusal.js'
import { type Box, gradientUnder, IDENTITY, type Matrix, multiply, readTransform, spreadUnder } from './svg-transform.js'
import type { Paint } from './svg-values.js'

export interface Cost {
  /** Weighted segments: what `MAX_SVG_SEGMENTS` bounds. */
  readonly segments: number
  /** Transparency groups, in units: what `MAX_SVG_GROUPS` bounds. */
  readonly groups: number
  /** What the converter draws each time it draws the drawing: moves, lines and closes; curves; elements it reads, a clip path's again for every element it clips; and gradient stops it writes, a gradient's again for every shape painted with it. */
  readonly drawn: { readonly lines: number; readonly curves: number; readonly elements: number; readonly stops: number }
  /** How far the numbers the converter writes for it reach, and how deep it nests the graphics state. */
  readonly extent: SvgExtent
}

/** A curve costs a reader what three lines do (limits.ts). */
const CURVE = 3
/** A stroke costs a reader what painting its outline twice more does. */
const STROKE = 2
/** A translucent gradient is two page-sized objects, a clip or a group opacity one. */
const TRANSLUCENT_GRADIENT = 2

interface Painted {
  readonly painted: boolean
  readonly stops: number
  readonly translucent: boolean
}

const UNPAINTED: Painted = { painted: false, stops: 0, translucent: false }

export function costOf(drawing: Drawing): Cost {
  const counted = new Counter(drawing)
  counted.visit(drawing.root, 1, false, PAGE, IDENTITY)
  return counted.checked()
}

/** The content stream an element is drawn into: the page's, or a group's, in which PDFKit's matrix starts again from the identity; and the depth its saves count from. */
interface Stream {
  readonly grouped: boolean
  readonly base: number
}

/** The page's stream, where the converter saves the graphics state once before the svg saves it (`source.js:2727`): the root, one deep, saves at two. */
const PAGE: Stream = { grouped: false, base: -1 }

const NOTHING_DRAWN = { moves: 0, lines: 0, curves: 0, length: 0, box: [0, 0, 0, 0] as [number, number, number, number] }

class Counter {
  private readonly drawing: Drawing
  private segments = 0
  private groups = 0
  private lines = 0
  private curves = 0
  private elements = 0
  /** Elements the converter reads: every element once, and a clip path's shapes again for each element it clips. */
  private reads = 0
  private stops = 0
  private paints = false
  private readonly extent: Extent

  constructor(drawing: Drawing) {
    this.drawing = drawing
    this.extent = new Extent(drawing.viewBox)
  }

  /**
   * Every element, each shape and clip counted where it draws; clip paths'
   * and gradients' content only where something uses it. A clip and a
   * group at an opacity are each a page-sized group drawn under the
   * element's matrix, and a group with either draws what it holds into a
   * stream of its own (`source.js:1564-1577`). `outer` is the matrix the
   * element is drawn under in its stream, from where the stream began, its
   * own transform not yet included.
   */
  visit(node: Written, depth: number, inside: boolean, stream: Stream, outer: Matrix): void {
    this.elements += 1
    this.reads += 1
    if (this.elements > MAX_SVG_ELEMENTS) refuse('too-large', `the cleaned drawing has more than ${MAX_SVG_ELEMENTS} elements`)
    if (depth > MAX_SVG_DEPTH) refuse('too-deep', `${node.source.path} is written past ${MAX_SVG_DEPTH} levels`)
    const draws = !inside && (node.name === 'g' || SHAPES.has(node.name))
    const clip = draws ? node.styled.clip : undefined
    const translucent = draws && node.name === 'g' && node.styled.opacity < 1
    const at = draws ? multiply(outer, ownMatrix(node)) : outer
    if (draws) this.extent.nest(depth - stream.base)
    if (clip !== undefined) this.clip(node, clip.id)
    if (translucent) this.groups += 1
    if ((clip !== undefined || translucent) && node.under !== undefined) this.extent.group(node.under)
    if (draws && SHAPES.has(node.name)) this.shape(node, stream, at)
    const grouped = node.name === 'g' && (clip !== undefined || translucent)
    const inner = grouped ? { grouped, base: depth } : stream
    for (const child of node.children) this.visit(child, depth + 1, inside || !(node.name === 'g' || node.name === 'svg'), inner, grouped ? IDENTITY : at)
  }

  /** The costs, refused past their bounds, and a drawing that paints nothing refused. */
  checked(): Cost {
    const { segments, groups } = this
    if (!this.paints) refuse('unsupported', 'the drawing paints nothing', 'give what it draws a fill or a stroke')
    if (segments > MAX_SVG_SEGMENTS) refuse('too-large', `the drawing costs ${segments} weighted segments to paint; the limit is ${MAX_SVG_SEGMENTS}`)
    if (groups > MAX_SVG_GROUPS) refuse('too-large', `the drawing makes ${groups} units of transparency groups; the limit is ${MAX_SVG_GROUPS}`, 'flatten its clips and its transparency')
    return { segments, groups, drawn: { lines: this.lines, curves: this.curves, elements: this.reads, stops: this.stops }, extent: this.extent.extent() }
  }

  /** What a paint draws with, as the converter decides it (`source.js:1505-1528`): nothing at an alpha of 0, a gradient's stops, translucent when one comes out under 1. */
  private painted(paint: Paint, alpha: number): Painted {
    if (paint.kind === 'none' || alpha === 0) return UNPAINTED
    if (paint.kind !== 'url') return { painted: true, stops: 0, translucent: false }
    const stops = this.drawing.targets.get(paint.id)?.children ?? []
    if (stops.length === 0) return UNPAINTED
    return { painted: true, stops: stops.length, translucent: stops.length > 1 && stops.some((stop) => stop.styled.stopOpacity * alpha < 1) }
  }

  /** A shape drawn under `at` in its stream: its outline, its paints, and what painting them costs. */
  private shape(node: Written, stream: Stream, at: Matrix): void {
    const { computed, opacity } = node.styled
    const drawn = node.drawn ?? NOTHING_DRAWN
    this.extent.outline(drawn.box)
    const fill = this.painted(computed.fill, computed.fillOpacity * opacity)
    const stroke = computed.strokeWidth > 0 ? this.painted(computed.stroke, computed.strokeOpacity * opacity) : UNPAINTED
    if (fill.stops > 1 && computed.fill.kind === 'url') this.pattern(node, computed.fill.id, stream, at)
    if (stroke.stops > 1 && computed.stroke.kind === 'url') this.pattern(node, computed.stroke.id, stream, at)
    const weight = drawn.moves + drawn.lines + CURVE * drawn.curves
    this.segments += weight * ((fill.painted ? 1 : 0) + (stroke.painted ? STROKE : 0) || 1) + fill.stops + stroke.stops
    this.groups += (fill.translucent ? TRANSLUCENT_GRADIENT : 0) + (stroke.translucent ? TRANSLUCENT_GRADIENT : 0)
    if (stroke.painted && computed.dashes !== 'none') {
      const period = computed.dashes.reduce((sum, dash) => sum + dash, 0)
      this.segments += Math.ceil(((drawn.length / period) * computed.dashes.length) / 2)
    }
    this.lines += drawn.moves + drawn.lines
    this.curves += drawn.curves
    this.stops += fill.stops + stroke.stops
    this.paints ||= fill.painted || stroke.painted
  }

  /** A gradient of two stops or more, which the converter writes as a pattern, held where it is drawn from the root for the shape `node` (`gradientUnder`) and measured in the stream it is painted in, under `at` there. */
  private pattern(node: Written, id: string, stream: Stream, at: Matrix): void {
    const pattern = this.drawing.targets.get(id)?.pattern
    if (pattern === undefined || node.under === undefined) return
    const box = pattern.inBox ? (node.drawn ?? NOTHING_DRAWN).box : undefined
    const drawn = gradientUnder(node.under, box, pattern.matrix, node.source.path)
    if (stream.grouped) this.extent.inGroup(spreadUnder(at, box, pattern.matrix))
    else this.extent.pattern(drawn)
  }

  /** A clip path, drawn again for the element `node` that refers to it: its shapes' outlines, filled once each, in the box of `node` when its units are that box. */
  private clip(node: Written, id: string): void {
    this.groups += 1
    const target = this.drawing.targets.get(id)
    if (target?.geometry.some(([name, value]) => name === 'clipPathUnits' && value === 'objectBoundingBox') === true) this.extent.clipBox(boxOf(node))
    for (const child of target?.children ?? []) {
      const drawn = child.drawn ?? NOTHING_DRAWN
      this.extent.outline(drawn.box)
      this.segments += drawn.moves + drawn.lines + CURVE * drawn.curves
      this.lines += drawn.moves + drawn.lines
      this.curves += drawn.curves
      this.reads += 1
    }
  }
}

/** The matrix an element's own transform writes, as the converter reads it from the cleaned drawing; the identity where it has none. */
function ownMatrix(node: Written): Matrix {
  return node.transform === undefined ? IDENTITY : readTransform(node.transform, node.source.path)
}

/**
 * The box of what a clip in objectBoundingBox units clips, in its own
 * coordinates, as the converter measures one (`source.js:1535-1549`): a
 * shape's own box, or the boxes of a group's shapes through the matrices
 * between it and each -- each element's own, composed down, as the
 * converter transforms each child's outline by its own -- their corners
 * taken, so that it holds the box of any outline inside them.
 */
function boxOf(node: Written): Box {
  if (node.name !== 'g') return (node.drawn ?? NOTHING_DRAWN).box
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  const walk = (at: Written, outer: Matrix): void => {
    for (const child of at.children) {
      const matrix = multiply(outer, ownMatrix(child))
      if (child.name === 'g') walk(child, matrix)
      if (!SHAPES.has(child.name) || child.drawn === undefined) continue
      const [a, b, c, d, e, f] = matrix
      const [left, top, right, bottom] = child.drawn.box
      for (const [x, y] of [[left, top], [right, top], [right, bottom], [left, bottom]] as const) {
        const [u, v] = [a * x + c * y + e, b * x + d * y + f]
        box[0] = Math.min(box[0], u)
        box[1] = Math.min(box[1], v)
        box[2] = Math.max(box[2], u)
        box[3] = Math.max(box[3], v)
      }
    }
  }
  walk(node, IDENTITY)
  return box
}
