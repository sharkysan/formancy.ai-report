/**
 * Gradients: the chain of gradients one names through `href` followed and
 * flattened into one, and its geometry read in the units it is drawn in
 * (0030).
 *
 * A gradient takes, from the gradient it names, each of its own attributes
 * it does not set, and the stops when it has none (SVG 1.1, 13.2.2 and
 * 13.2.3); the written gradient has no `href`. A chain that leaves the file,
 * names what is not a gradient, comes back on itself or is longer than
 * `MAX_SVG_DEPTH` is refused: the converter follows a chain with no check
 * for a cycle (`source.js:1825-1836`).
 *
 * `spreadMethod` is read as `pad` alone, until `reflect` and `repeat` are
 * measured against a browser; a radial gradient's focal radius `fr`, which
 * the converter does not read, is refused as an attribute it does not know.
 */
import { MAX_SVG_DEPTH, MAX_SVG_STOPS } from './limits.js'
import { GEOMETRY, GRADIENTS } from './svg-allow.js'
import { writeNumber } from './svg-number.js'
import { refuse } from './svg-refusal.js'
import { IDENTITY, isIdentity, type Matrix, readTransform, writeMatrix } from './svg-transform.js'
import type { Located, SvgElement } from './svg-tree.js'
import { readLength } from './svg-values.js'

export interface FlatGradient {
  readonly geometry: ReadonlyArray<readonly [string, string]>
  /** The stops it is drawn with, which may be another gradient's. */
  readonly stops: readonly SvgElement[]
  /** Its gradientTransform, and whether it is drawn in the box of what it paints. */
  readonly matrix: Matrix
  readonly inBox: boolean
}

/** The gradients a gradient names, itself first, followed until one names none. */
function chain(gradient: SvgElement, ids: ReadonlyMap<string, SvgElement>): SvgElement[] {
  const chained = [gradient]
  for (let href = gradient.attributes.get('href'); href !== undefined; ) {
    const target = href.value.trim()
    if (!target.startsWith('#')) refuse('reference', `${href.where} refers to something outside the file`, 'put the gradient it names into the file')
    const next = ids.get(target.slice(1))
    if (next === undefined || !GRADIENTS.has(next.name)) refuse('reference', `${href.where} names no gradient in the file`, 'name a gradient in the file')
    if (chained.includes(next)) refuse('reference', `${href.where} is a cycle of gradients naming each other`, 'make one of them name none')
    if (chained.length >= MAX_SVG_DEPTH) refuse('too-deep', `${href.where} is a chain of more than ${MAX_SVG_DEPTH} gradients`, 'give the gradient its own stops and attributes')
    chained.push(next)
    href = next.attributes.get('href')
  }
  return chained
}

const UNITS = ['userSpaceOnUse', 'objectBoundingBox']

/** A gradient with its chain followed: its geometry as written, in table order, and its stops. */
export function flattenGradient(gradient: SvgElement, ids: ReadonlyMap<string, SvgElement>): FlatGradient {
  const chained = chain(gradient, ids)
  const taken = (name: string): Located | undefined => {
    for (const link of chained) {
      const attribute = link.attributes.get(name)
      if (attribute !== undefined) return attribute
    }
    return undefined
  }
  const units = taken('gradientUnits')
  if (units !== undefined && !UNITS.includes(units.value)) refuse('unsupported', `${units.where} is not userSpaceOnUse or objectBoundingBox`)
  const inBox = units?.value !== 'userSpaceOnUse'
  const geometry: Array<readonly [string, string]> = []
  let matrix = IDENTITY
  for (const name of GEOMETRY[gradient.name]) {
    const attribute = taken(name)
    if (attribute === undefined) continue
    if (name === 'gradientUnits') geometry.push([name, attribute.value])
    else if (name === 'spreadMethod') {
      if (attribute.value !== 'pad') refuse('unsupported', `${attribute.where} is a spread this format draws as pad alone`, 'expand the repeated gradient into shapes, or use pad')
      geometry.push([name, 'pad'])
    } else if (name === 'gradientTransform') {
      matrix = readTransform(attribute.value, attribute.where)
      if (!isIdentity(matrix)) geometry.push([name, writeMatrix(matrix)])
    } else {
      const length = readLength(attribute.value, attribute.where, inBox)
      if (name === 'r' && !(length.value > 0)) refuse('out-of-range', `${attribute.where} is a radial gradient of no radius`, 'give it a radius, or paint with its last colour')
      geometry.push([name, writeNumber(length)])
    }
  }
  const stops = chained.find((link) => link.children.length > 0)?.children ?? []
  if (stops.length > MAX_SVG_STOPS) refuse('too-large', `${gradient.path} has more than ${MAX_SVG_STOPS} stops`)
  return { geometry, stops, matrix, inBox }
}
