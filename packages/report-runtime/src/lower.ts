/**
 * A report's components lowered to the document's blocks, region by region.
 *
 * Every component is read in the report's scope: its condition first, and a
 * component whose condition does not hold prints nothing, nor does anything
 * inside it. Then its style (`styles.ts`), and then what it is. A kind maps
 * to a block through a table over every kind, so a kind added to the format
 * without a way down does not compile.
 *
 * The report header is the start of the body and the summary its end, so
 * the document has three regions: the page header and footer, repeated on
 * every page, and the body.
 */
import type { Component, ComponentKind, RegionName } from '@formancy/report-spec'
import type { Block, TextStyle } from './document.js'
import { imageBlock } from './images.js'
import { runOf } from './inlines.js'
import { tableBlock } from './lower-table.js'
import { holds, reportScope } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { styled } from './styles.js'

/** The document's regions, lowered. */
export interface LoweredRegions {
  readonly pageHeader: readonly Block[]
  readonly pageFooter: readonly Block[]
  readonly body: readonly Block[]
}

/** What one component is lowered with: where it is, the report scope, and its resolved style. */
interface At {
  readonly render: Render
  readonly scope: Scope
  readonly path: string
  readonly style: TextStyle | undefined
}

type Lowerer<K extends ComponentKind> = (component: Extract<Component, { kind: K }>, at: At) => Block | undefined

/** `value` under `key` when it is defined: the document writes only what is set. */
const optional = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } => (value === undefined ? {} : ({ [key]: value } as { [P in K]: V }))

const LOWER: { readonly [K in ComponentKind]: Lowerer<K> } = {
  text: (text, { render, scope, path, style }) => {
    const runs = text.content.flatMap((inline, index) => runOf(render, scope, inline, `${path}/content/${index}`, { componentId: text.id }) ?? [])
    return { kind: 'paragraph', runs, ...optional('style', style), ...(text.keepWithNext === true ? { keepWithNext: true } : {}) }
  },
  image: (image, { render, path }) => imageBlock(render, image, path),
  line: (line) => ({ kind: 'rule', thickness: line.thickness, ...optional('color', line.color) }),
  rectangle: (rectangle) => ({ kind: 'rectangle', width: rectangle.width, height: rectangle.height, ...optional('fill', rectangle.fill), ...optional('stroke', rectangle.stroke) }),
  spacer: (spacer) => ({ kind: 'spacer', height: spacer.height }),
  columns: (columns, { render, path, style }) => ({
    kind: 'columns',
    columns: columns.columns.map((slot, index) => ({ width: slot.width, blocks: blocksOf(render, slot.components, `${path}/columns/${index}/components`, style) })),
  }),
  section: (section, { render, path, style }) => ({
    kind: 'section',
    blocks: blocksOf(render, section.components, `${path}/components`, style),
    ...optional('border', section.border),
    ...optional('fill', section.fill),
    ...optional('padding', section.padding),
  }),
  table: (table, { render, path, style }) => tableBlock(render, table, path, style),
  pageBreak: () => ({ kind: 'pageBreak' }),
  keepTogether: (kept, { render, path, style }) => ({ kind: 'keepTogether', blocks: blocksOf(render, kept.components, `${path}/components`, style) }),
}

/** `component`, at `path`, as the block it prints; undefined when it prints nothing, or could not be lowered, which is recorded. */
function blockOf(render: Render, component: Component, path: string, inherited: TextStyle | undefined): Block | undefined {
  const scope = reportScope(render, render.totals.report)
  if (component.visibleWhen !== undefined && holds(render, scope, `${path}/visibleWhen/cel`) !== true) return undefined
  const style = styled(render, scope, inherited, component.style, component.styleWhen, `${path}/styleWhen`)
  return (LOWER[component.kind] as Lowerer<ComponentKind>)(component as never, { render, scope, path, style })
}

/** The components of the list at `path`, in order, as the blocks they print. */
function blocksOf(render: Render, components: readonly Component[], path: string, inherited: TextStyle | undefined): Block[] {
  return components.flatMap((component, index) => blockOf(render, component, `${path}/${index}`, inherited) ?? [])
}

function region(render: Render, name: RegionName): Block[] {
  return blocksOf(render, render.report.regions[name], `/regions/${name}`, undefined)
}

/** Every region of `render`'s report, lowered: the report header, body and summary as the one body. */
export function lowerRegions(render: Render): LoweredRegions {
  return {
    pageHeader: region(render, 'pageHeader'),
    pageFooter: region(render, 'pageFooter'),
    body: [...region(render, 'reportHeader'), ...region(render, 'body'), ...region(render, 'summary')],
  }
}
