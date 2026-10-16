/**
 * Print styles resolved to the one style each piece of text prints in.
 *
 * report-spec's styles are tokens (0007); here they are laid over each other
 * once, and the document carries the result, so an engine never merges
 * styles (`TextStyle`). The order, each later one's property winning:
 *
 * 1. what the component stands in passes down: a section's, a columns
 *    block's or a keep-together block's style is the base of the text
 *    inside it;
 * 2. the component's own `style`;
 * 3. each of its `styleWhen` rules that holds, in order.
 *
 * In a table, the table's resolved style is the base of every row: the
 * header's `headerStyle`, a group header's, a footer row's own, and each
 * column's style and rules over a detail cell. An image, a QR code, a line,
 * a rectangle, a spacer and a page break print no text; a style on one is
 * read for its rules' conditions, and changes nothing.
 */
import type { PrintStyle, StyleRule } from '@formancy/report-spec'
import type { TextStyle } from './document.js'
import { holds } from './render-context.js'
import type { Render, Scope } from './render-context.js'

/** Each print style as the document's: the same tokens without the id. */
export function documentStyles(styles: readonly PrintStyle[]): ReadonlyMap<string, TextStyle> {
  return new Map(styles.map(({ id, ...style }) => [id, style]))
}

/** `styles` laid over each other, a later one's property winning; undefined when none sets anything. */
export function layered(...styles: readonly (TextStyle | undefined)[]): TextStyle | undefined {
  const merged: TextStyle = Object.assign({}, ...styles.filter((style) => style !== undefined)) as TextStyle
  return Object.keys(merged).length === 0 ? undefined : merged
}

/**
 * `base`, then the print style `style` names, then each rule at
 * `<path>/<index>` whose condition holds in `scope`. Undefined when nothing
 * sets anything, or when a condition failed, which is recorded.
 */
export function styled(render: Render, scope: Scope, base: TextStyle | undefined, style: string | undefined, rules: readonly StyleRule[] | undefined, path: string): TextStyle | undefined {
  const held: TextStyle[] = []
  for (const [index, rule] of (rules ?? []).entries()) {
    if (holds(render, scope, `${path}/${index}/when/cel`) === true) held.push(render.styles.get(rule.style) as TextStyle)
  }
  return layered(base, style === undefined ? undefined : render.styles.get(style), ...held)
}
