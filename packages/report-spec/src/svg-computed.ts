/**
 * Each element's properties after the cascade and inheritance: what the
 * cleaner writes on it, and what it paints with, which the costs are
 * counted from (0030).
 *
 * The cleaner does not push values down the tree: it writes each element's
 * own values and leaves inheritance to the converter, which inherits as SVG
 * says (`source.js:25-66`). One exception: `currentColor` is written as the
 * colour it stands for, and an inherited `currentColor` is the keyword, not
 * the colour, so a child that sets another `color` paints in its own (CSS
 * Color 4, 6.4). svg-to-pdfkit inherits the colour its parent resolved, as
 * SVG 1.1 did; so where a child's colour differs, the cleaner writes the
 * child's paint on the child, and both readers draw what a browser draws.
 */
import { INHERITED, type Property, WRITTEN_PROPERTIES, type WrittenProperty } from './svg-allow.js'
import { writeNumber } from './svg-number.js'
import { cascade, type Declared, type Stylesheet } from './svg-style.js'
import type { SvgElement } from './svg-tree.js'
import { type Colour, INHERIT, type Paint, type Value } from './svg-values.js'
import type { Removals } from './svg-refusal.js'

/** A reference to a gradient or a clip path, by the id the file gave it. */
export interface Reference {
  readonly id: string
  readonly where: string
}

/** A property as it is written: its text, or a reference written with the id its target is renamed to, and a fallback colour. */
export type WrittenValue = string | { readonly reference: Reference; readonly fallback: string | undefined }

export interface Computed {
  readonly fill: Paint
  readonly fillOpacity: number
  readonly stroke: Paint
  readonly strokeOpacity: number
  readonly strokeWidth: number
  readonly dashes: readonly number[] | 'none'
  /** The colour `currentColor` stands for here. */
  readonly color: string
  /** How a clip path's shapes clip: inherited, and written on a clip path, so that its clip never rests on `defs`. */
  readonly clipRule: string
  /** The colour an inherited `currentColor` fill or stroke is written as above this element, when it is one. */
  readonly fillAs: string | undefined
  readonly strokeAs: string | undefined
}

export interface Styled {
  readonly computed: Computed
  /** The kept properties written on the element, in the canonical order. */
  readonly written: ReadonlyArray<readonly [WrittenProperty, WrittenValue]>
  /** `display: none`: the element and everything in it is removed. */
  readonly hidden: boolean
  /** The element's own opacity, which is not inherited. */
  readonly opacity: number
  /** A stop's own opacity, which is not inherited either. */
  readonly stopOpacity: number
  readonly clip: Reference | undefined
}

const INITIAL: Computed = {
  fill: { kind: 'colour', hex: '#000000' },
  fillOpacity: 1,
  stroke: { kind: 'none' },
  strokeOpacity: 1,
  strokeWidth: 1,
  dashes: 'none',
  color: '#000000',
  clipRule: 'nonzero',
  fillAs: undefined,
  strokeAs: undefined,
}

/** Every element's styled properties, the tree walked from the root, its parent's computed values in hand. */
export function styleTree(root: SvgElement, sheet: Stylesheet, removals: Removals): Map<SvgElement, Styled> {
  const styled = new Map<SvgElement, Styled>()
  const walk = (element: SvgElement, parent: Computed): void => {
    const own = style(cascade(element, sheet, removals), parent)
    styled.set(element, own)
    for (const child of element.children) walk(child, own.computed)
  }
  walk(root, INITIAL)
  return styled
}

function colourOf(colour: Colour, color: string): string {
  return colour.kind === 'current' ? color : colour.hex
}

function numberOf(value: Value | undefined, otherwise: number): number {
  return value?.type === 'number' ? value.number.value : otherwise
}

function own(specified: ReadonlyMap<Property, Declared>, property: Property): Value | undefined {
  const declared = specified.get(property)
  return declared === undefined || declared.value === INHERIT ? undefined : declared.value
}

function style(specified: ReadonlyMap<Property, Declared>, parent: Computed): Styled {
  const colorValue = own(specified, 'color')
  const color = colorValue?.type === 'colour' ? colourOf(colorValue.colour, parent.color) : parent.color
  const written: Array<readonly [WrittenProperty, WrittenValue]> = []
  const paints = { fill: { paint: parent.fill, as: parent.fillAs }, stroke: { paint: parent.stroke, as: parent.strokeAs } }
  for (const property of WRITTEN_PROPERTIES) {
    const declared = specified.get(property)
    const value = own(specified, property)
    if (property === 'fill' || property === 'stroke') {
      const painted = paints[property]
      if (value?.type === 'paint') {
        painted.paint = value.paint
        painted.as = value.paint.kind === 'current' ? color : undefined
        written.push([property, writePaint(value.paint, color, declared?.where ?? '')])
      } else if (painted.paint.kind === 'current' && painted.as !== color) {
        // An inherited currentColor, under a colour of this element's own.
        painted.as = color
        written.push([property, color])
      }
    } else if (value !== undefined && value.type !== 'paint') written.push([property, writeValue(value, color, declared?.where ?? '')])
  }
  const inherited = (property: Property, from: number): number => (INHERITED.has(property) ? numberOf(own(specified, property), from) : from)
  const dashes = own(specified, 'stroke-dasharray')
  const clip = own(specified, 'clip-path')
  const display = own(specified, 'display')
  const clipRule = own(specified, 'clip-rule')
  return {
    computed: {
      fill: paints.fill.paint,
      fillOpacity: inherited('fill-opacity', parent.fillOpacity),
      stroke: paints.stroke.paint,
      strokeOpacity: inherited('stroke-opacity', parent.strokeOpacity),
      strokeWidth: inherited('stroke-width', parent.strokeWidth),
      dashes: dashes?.type === 'dashes' ? (dashes.dashes === 'none' ? 'none' : dashes.dashes.map((dash) => dash.value)) : parent.dashes,
      color,
      clipRule: clipRule?.type === 'keyword' ? clipRule.keyword : parent.clipRule,
      fillAs: paints.fill.as,
      strokeAs: paints.stroke.as,
    },
    written,
    hidden: display?.type === 'keyword' && display.keyword === 'none',
    opacity: numberOf(own(specified, 'opacity'), 1),
    stopOpacity: numberOf(own(specified, 'stop-opacity'), 1),
    clip: clip?.type === 'clip' && clip.id !== undefined ? { id: clip.id, where: specified.get('clip-path')?.where ?? '' } : undefined,
  }
}

function writePaint(paint: Paint, color: string, where: string): WrittenValue {
  switch (paint.kind) {
    case 'none':
      return 'none'
    case 'url':
      return {
        reference: { id: paint.id, where },
        fallback: paint.fallback === undefined ? undefined : paint.fallback.kind === 'none' ? 'none' : colourOf(paint.fallback, color),
      }
    default:
      return colourOf(paint, color)
  }
}

/** Every value but a paint, which only fill and stroke take. */
function writeValue(value: Exclude<Value, { readonly type: 'paint' }>, color: string, where: string): WrittenValue {
  switch (value.type) {
    case 'colour':
      return colourOf(value.colour, color)
    case 'number':
      return writeNumber(value.number)
    case 'keyword':
      return value.keyword
    case 'dashes':
      return value.dashes === 'none' ? 'none' : value.dashes.map(writeNumber).join(' ')
    default:
      return value.id === undefined ? 'none' : { reference: { id: value.id, where }, fallback: undefined }
  }
}
