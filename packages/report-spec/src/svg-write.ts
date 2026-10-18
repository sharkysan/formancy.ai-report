/**
 * The canonical form a cleaned SVG is written in (0030), from the
 * cleaner's own tree; it never copies a span of the input.
 *
 * ```
 * svg   := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' n ' ' n ' ' n ' ' n '">' child* '</svg>'
 * child := '<' name attrs '/>' | '<' name attrs '>' child+ '</' name '>'
 * attrs := (' ' attr '="' value '"')*   id, then geometry, transform, paint, each in its table's order
 * id    := ('g' | 'c') digits           gradients g1, g2 …; clip paths c1, c2 …, in document order
 * ```
 *
 * ASCII alone, no whitespace but the single separators, no text, entity,
 * comment, declaration, namespace prefix or unused id. pdfmake reads the
 * file with xmldoc and sax and svg-to-pdfkit again with its own regexes;
 * with nothing in it but elements and plain attributes, every one of them
 * reads the same tree. Every value is generated from a parsed number or a
 * token, so none of `<>&"'` can be in one; the writer refuses to write one
 * that holds any rather than escape it.
 */
import type { WrittenValue } from './svg-computed.js'
import type { Drawing, Written } from './svg-drawing.js'
import { SVG_NAMESPACE } from './svg-tree.js'

const MARKUP = /[<>&"'\u0080-￿]/

/** One attribute as written, which no value may break out of. */
export function attribute(name: string, value: string): string {
  if (MARKUP.test(value)) throw new Error(`the SVG writer was handed markup or a byte past ASCII for ${name}; a value is always generated, so this is a bug in the cleaner`)
  return ` ${name}="${value}"`
}

export function writeDrawing(drawing: Drawing): string {
  const parts: string[] = []
  const reference = (value: WrittenValue): string => {
    if (typeof value === 'string') return value
    const id = drawing.targets.get(value.reference.id)?.id
    // Every reference kept names a target the drawing writes with an id; one that does not would write `url(#)`, which cleaning would then refuse.
    if (id === undefined) throw new Error(`the SVG writer was handed a reference to nothing it writes, at ${value.reference.where}; every reference kept names a target, so this is a bug in the cleaner`)
    return `url(#${id})${value.fallback === undefined ? '' : ` ${value.fallback}`}`
  }
  const write = (node: Written): void => {
    let attributes = node.name === 'svg' ? attribute('xmlns', SVG_NAMESPACE) : ''
    if (node.id !== undefined) attributes += attribute('id', node.id)
    for (const [name, value] of node.geometry) attributes += attribute(name, value)
    if (node.transform !== undefined) attributes += attribute('transform', node.transform)
    for (const [name, value] of node.properties) attributes += attribute(name, reference(value))
    if (node.children.length === 0) {
      parts.push(`<${node.name}${attributes}/>`)
      return
    }
    parts.push(`<${node.name}${attributes}>`)
    node.children.forEach(write)
    parts.push(`</${node.name}>`)
  }
  write(drawing.root)
  return parts.join('')
}
