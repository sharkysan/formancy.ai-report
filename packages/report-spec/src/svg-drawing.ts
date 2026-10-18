/**
 * The drawing a cleaned SVG holds, built from the styled tree: what is
 * hidden or of no size removed, every reference checked and its target
 * kept, every gradient flattened, what nothing refers to removed, and the
 * root's own paint and transform moved onto one group inside it (0030).
 *
 * The root is written with its namespace and its viewBox alone. A
 * transform on the root would move the drawing and its clip off the
 * report's box -- over a QR-bill's amount, say -- and paint on it would be
 * dropped, printing a stroke-only logo as black blobs; on a group inside
 * it, both draw as the author drew them, inside the box (0030).
 *
 * References are kept only inside the file: a fill or a stroke may name a
 * gradient, a clip-path a clip path, and nothing else may name anything.
 * One that names nothing, the wrong kind of thing, or something inside
 * what is removed, is refused rather than drawn otherwise.
 */
import { GRADIENTS, type KeptElement, SHAPES, WRITTEN_ON, type WrittenProperty } from './svg-allow.js'
import type { Styled, WrittenValue } from './svg-computed.js'
import { flattenGradient } from './svg-gradient.js'
import { float, writeNumber } from './svg-number.js'
import { type Drawn } from './svg-path.js'
import { refuse, type Removals } from './svg-refusal.js'
import { readShape } from './svg-shapes.js'
import { compose, IDENTITY, isIdentity, type Matrix, readTransform, writeMatrix } from './svg-transform.js'
import type { SvgDocument, SvgElement } from './svg-tree.js'
import { readLength, readNumbers, readOpacity } from './svg-values.js'

/** An element of the cleaned drawing, as it is written. */
export interface Written {
  readonly name: KeptElement
  readonly source: SvgElement
  geometry: ReadonlyArray<readonly [string, string]>
  readonly transform: string | undefined
  readonly properties: ReadonlyArray<readonly [WrittenProperty, WrittenValue]>
  children: Written[]
  readonly styled: Styled
  /** What a shape draws. */
  readonly drawn: Drawn | undefined
  /** The matrix a shape or a group is drawn under, from the root down, its own transform included. */
  readonly under?: Matrix
  /** A gradient's transform, and whether it is drawn in the box of what it paints, once something refers to it. */
  pattern?: { readonly matrix: Matrix; readonly inBox: boolean }
  /** The id it is written with, when something refers to it. */
  id: string | undefined
}

export interface ViewBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Drawing {
  readonly root: Written
  readonly viewBox: ViewBox
  /** What each reference's id names, among the gradients and clip paths kept. */
  readonly targets: ReadonlyMap<string, Written>
}

type Context = 'draw' | 'defs' | 'clip'

export function buildDrawing(document: SvgDocument, styled: ReadonlyMap<SvgElement, Styled>, removals: Removals): Drawing {
  return new DrawingBuilder(document, styled, removals).build()
}

class DrawingBuilder {
  private readonly document: SvgDocument
  private readonly styled: ReadonlyMap<SvgElement, Styled>
  private readonly removals: Removals
  private readonly ids = new Map<string, SvgElement>()
  /** The gradients and clip paths built, by the element they come from. */
  private readonly built = new Map<SvgElement, Written>()
  private readonly flattened = new Set<Written>()

  constructor(document: SvgDocument, styled: ReadonlyMap<SvgElement, Styled>, removals: Removals) {
    this.document = document
    this.styled = styled
    this.removals = removals
    const index = (element: SvgElement): void => {
      if (element.id !== undefined) this.ids.set(element.id, element)
      element.children.forEach(index)
    }
    index(document.root)
  }

  private style(element: SvgElement): Styled {
    return this.styled.get(element) as Styled
  }

  build(): Drawing {
    const { root } = this.document
    const viewBox = this.viewBox()
    const rootStyled = this.style(root)
    if (rootStyled.hidden) refuse('unsupported', 'svg is hidden: the drawing paints nothing', 'show the drawing')
    const transform = this.transform(root, IDENTITY)
    const children = this.children(root, transform.matrix, 'draw')
    const paint = this.drawable('g', rootStyled.written)
    const moved = paint.length > 0 || transform.written !== undefined
    const group: Written = { name: 'g', source: root, geometry: [], transform: transform.written, properties: paint, children, styled: rootStyled, drawn: undefined, under: transform.matrix, id: undefined }
    const svg: Written = {
      name: 'svg',
      source: root,
      geometry: [['viewBox', [viewBox.x, viewBox.y, viewBox.width, viewBox.height].map((n) => writeNumber(float(n))).join(' ')]],
      transform: undefined,
      properties: [],
      children: moved ? [group] : children,
      styled: { ...rootStyled, written: [], opacity: 1, clip: undefined },
      drawn: undefined,
      id: undefined,
    }
    // Every reference is checked where it is made, then what draws is found
    // from the shapes up and everything else removed, in one pass each.
    const kept = this.used(svg, this.references(svg))
    this.prune(svg, kept)
    const targets = new Map([...this.references(svg)].filter(([, target]) => kept.has(target)))
    for (const target of targets.values())
      if (target.name === 'clipPath' && target.children.length === 0)
        refuse('unsupported', `${target.source.path} is a clip path with nothing in it, which hides what it clips`, 'put the shape it clips to inside it, or remove the clip')
    this.unwrap(svg)
    this.name(svg, new Set(targets.values()))
    return { root: svg, viewBox, targets }
  }

  /** The root's viewBox, or `0 0 width height` from its size when it has none. */
  private viewBox(): ViewBox {
    const { root, width, height } = this.document
    const written = root.attributes.get('viewBox')
    if (written === undefined) {
      if (width === undefined || height === undefined) refuse('out-of-range', 'svg has no viewBox, and no width and height to take one from', 'give the svg a viewBox')
      return this.box(0, 0, readLength(width.value, width.where, false).value, readLength(height.value, height.where, false).value, 'svg@width')
    }
    const numbers = readNumbers(written.value, written.where)
    if (numbers.length !== 4) refuse('unsupported', `${written.where} is not four numbers`, 'write it as four numbers: x, y, width and height')
    const [x, y, w, h] = numbers.map((n) => n.value) as [number, number, number, number]
    return this.box(x, y, w, h, written.where)
  }

  private box(x: number, y: number, width: number, height: number, where: string): ViewBox {
    if (!(width >= 1 && height >= 1)) refuse('out-of-range', `${where} gives the drawing a side under one unit`, 'scale the drawing up in the drawing program')
    return { x, y, width, height }
  }

  private transform(element: SvgElement, outer: Matrix): { readonly matrix: Matrix; readonly written: string | undefined } {
    const attribute = element.attributes.get('transform')
    if (attribute === undefined) return { matrix: outer, written: undefined }
    const own = readTransform(attribute.value, attribute.where)
    return { matrix: compose(outer, own, element.path), written: isIdentity(own) ? undefined : writeMatrix(own) }
  }

  private children(element: SvgElement, matrix: Matrix, context: Context): Written[] {
    const children: Written[] = []
    for (const child of element.children) {
      const written = this.element(child, matrix, context)
      if (written !== undefined) children.push(written)
    }
    return children
  }

  /** An element as it is written, or undefined when it is removed. */
  private element(element: SvgElement, outer: Matrix, context: Context): Written | undefined {
    const styled = this.style(element)
    const draws = element.name === 'g' || SHAPES.has(element.name)
    if (draws && (styled.hidden || context === 'defs')) {
      this.removals.add('element', element.link ? 'a' : element.name)
      return undefined
    }
    if (styled.clip !== undefined && (context === 'clip' || element.name === 'clipPath')) refuse('unsupported', `${element.path} is clipped inside a clip path`, 'clip it once, with one clip path')
    const { matrix, written: transform } = this.transform(element, element.name === 'clipPath' ? IDENTITY : outer)
    const shape = SHAPES.has(element.name) ? readShape(element) : undefined
    if (SHAPES.has(element.name) && shape === undefined) {
      this.removals.add('element', element.name)
      return undefined
    }
    const base = { name: element.name, source: element, transform, properties: this.properties(element, styled), styled, id: undefined }
    if (shape !== undefined) return { ...base, geometry: shape.geometry, children: [], drawn: shape.drawn, under: matrix }
    if (GRADIENTS.has(element.name)) {
      // Its geometry and stops are its chain's, taken when something refers to it.
      const gradient: Written = { ...base, geometry: [], children: [], drawn: undefined }
      this.built.set(element, gradient)
      return gradient
    }
    const geometry: Array<readonly [string, string]> = []
    const units = element.attributes.get('clipPathUnits')
    if (units !== undefined) {
      if (!['userSpaceOnUse', 'objectBoundingBox'].includes(units.value)) refuse('unsupported', `${units.where} is not userSpaceOnUse or objectBoundingBox`)
      geometry.push(['clipPathUnits', units.value])
    }
    const inner: Context = element.name === 'clipPath' ? 'clip' : element.name === 'defs' ? 'defs' : context
    const written: Written = { ...base, geometry, children: this.children(element, matrix, inner), drawn: undefined, ...(element.name === 'g' ? { under: matrix } : {}) }
    if (element.name === 'clipPath') this.built.set(element, written)
    return written
  }

  /** A stop as it is written, wherever its gradient is. */
  private stop(element: SvgElement): Written {
    const styled = this.style(element)
    const offset = element.attributes.get('offset')
    const geometry: Array<readonly [string, string]> = offset === undefined ? [] : [['offset', writeNumber(readOpacity(offset.value, offset.where))]]
    return { name: 'stop', source: element, geometry, transform: undefined, properties: this.drawable('stop', styled.written), children: [], styled, drawn: undefined, id: undefined }
  }

  /** `written` with only what draws on an element `name`, every other property removed and listed (`WRITTEN_ON`). */
  private drawable(name: KeptElement, written: Styled['written']): Styled['written'] {
    const keeps = WRITTEN_ON[name]
    return written.filter(([property]) => {
      if (keeps.has(property)) return true
      this.removals.add('property', property)
      return false
    })
  }

  /** What an element is written with: what draws on it, and on a clip path the clip rule it inherits, which `defs` then need not hold. */
  private properties(element: SvgElement, styled: Styled): Styled['written'] {
    const written = this.drawable(element.name, styled.written)
    if (element.name !== 'clipPath' || written.some(([property]) => property === 'clip-rule') || styled.computed.clipRule === 'nonzero') return written
    return [...written, ['clip-rule', styled.computed.clipRule]]
  }

  /** The target of a reference, refused unless it is a kept element of the kind the property names. */
  private target(id: string, where: string, gradient: boolean): Written {
    const element = this.ids.get(id)
    if (element === undefined) refuse('reference', `${where} names nothing in the file`, 'put what it names into the file, or remove the reference')
    const kind = gradient ? GRADIENTS.has(element.name) : element.name === 'clipPath'
    if (!kind) refuse('reference', `${where} names a ${element.link ? 'a' : element.name}, not a ${gradient ? 'gradient' : 'clip path'}`, `name a ${gradient ? 'gradient' : 'clip path'}`)
    const written = this.built.get(element)
    if (written === undefined) refuse('reference', `${where} names a ${gradient ? 'gradient' : 'clip path'} inside what is removed`, 'move what it names into defs')
    return written
  }

  /**
   * Every reference the drawing makes, checked, its gradients flattened:
   * first what draws, then what the clip paths it uses hold. What a clip
   * path nothing uses refers to is never followed, since it is removed.
   */
  private references(svg: Written): Map<string, Written> {
    const targets = new Map<string, Written>()
    // Each gradient is flattened once, however many rounds see it.
    const follow = (node: Written, inside: boolean): void => {
      if (node.name === 'clipPath' && !inside) return
      if (GRADIENTS.has(node.name)) return
      for (const [property, value] of node.properties) {
        if (typeof value === 'string') continue
        const gradient = property !== 'clip-path'
        const target = this.target(value.reference.id, value.reference.where, gradient)
        if (targets.has(value.reference.id)) continue
        targets.set(value.reference.id, target)
        if (!gradient) for (const child of target.children) follow(child, true)
        else if (!this.flattened.has(target)) {
          this.flattened.add(target)
          const flat = flattenGradient(target.source, this.ids)
          target.geometry = flat.geometry
          target.pattern = { matrix: flat.matrix, inBox: flat.inBox }
          target.children = flat.stops.map((stop) => this.stop(stop))
        }
      }
      for (const child of node.children) follow(child, inside)
    }
    follow(svg, false)
    return targets
  }

  /**
   * What draws, and what it needs, found from the shapes up so that each
   * element is visited once: every shape outside a gradient or a clip path;
   * every group or defs that holds something kept; every gradient and clip
   * path something kept refers to, and what a kept clip path's shapes refer
   * to. Removing what is left in rounds -- an empty group, then what only it
   * referred to, then the group that held that -- took a round for every
   * link of such a chain, and as many passes over the drawing.
   */
  private used(svg: Written, targets: ReadonlyMap<string, Written>): Set<Written> {
    const parents = new Map<Written, Written>()
    const kept = new Set<Written>()
    const pending: Written[] = []
    const keep = (node: Written): void => {
      if (kept.has(node)) return
      kept.add(node)
      pending.push(node)
    }
    const index = (node: Written, inside: boolean): void => {
      for (const child of node.children) {
        parents.set(child, node)
        if (!inside && SHAPES.has(child.name)) keep(child)
        index(child, inside || isDefinition(child))
      }
    }
    index(svg, false)
    const referred = (node: Written): void => {
      for (const [, value] of node.properties) {
        const target = typeof value === 'string' ? undefined : targets.get(value.reference.id)
        if (target !== undefined) keep(target)
      }
    }
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      referred(node)
      if (node.name === 'clipPath') node.children.forEach(referred)
      const parent = parents.get(node)
      if (parent !== undefined && !isDefinition(parent)) keep(parent)
    }
    return kept
  }

  /** Every element `kept` does not hold removed and listed, with every group, defs, gradient and clip path inside it. */
  private prune(node: Written, kept: ReadonlySet<Written>): void {
    node.children = node.children.filter((child) => {
      if (!kept.has(child)) {
        this.removed(child)
        return false
      }
      // What a kept gradient or clip path holds -- stops, or shapes -- holds nothing to prune.
      if (!isDefinition(child)) this.prune(child, kept)
      return true
    })
  }

  private removed(node: Written): void {
    if (!isDefinition(node)) for (const child of node.children) this.removed(child)
    this.removals.add('element', node.source.link ? 'a' : node.name)
  }

  /** Every group with nothing written on it unwrapped: it draws as its children do, and is written as them. */
  private unwrap(node: Written): void {
    for (const child of node.children) this.unwrap(child)
    node.children = node.children.flatMap((child) => {
      if (!this.bare(child)) return [child]
      if (child.source.id !== undefined) this.removals.add('attribute', 'id')
      return child.children
    })
  }

  /** A group with nothing written on it draws as its children do, and is written as them. */
  private bare(node: Written): boolean {
    return node.name === 'g' && node.transform === undefined && node.properties.length === 0
  }

  /**
   * Each gradient and clip path something refers to, named in document
   * order: g1, g2 … and c1, c2 …. Every other id is removed and listed:
   * nothing kept could refer to it.
   */
  private name(node: Written, used: ReadonlySet<Written>): void {
    let gradients = 0
    let clips = 0
    const walk = (at: Written): void => {
      if (used.has(at)) at.id = at.name === 'clipPath' ? `c${(clips += 1)}` : `g${(gradients += 1)}`
      else if (at.source.id !== undefined && (at.name !== 'g' || at.source.parent !== undefined)) this.removals.add('attribute', 'id')
      at.children.forEach(walk)
    }
    walk(node)
  }
}

/** A gradient or a clip path: drawn only where something refers to it. */
function isDefinition(node: Written): boolean {
  return GRADIENTS.has(node.name) || node.name === 'clipPath'
}
