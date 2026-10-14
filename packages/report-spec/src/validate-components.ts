/**
 * Components: the shape of each kind, and where each may stand.
 *
 * Kinds are a table, not a switch: each entry says which properties its
 * kind has, whether and how it holds other components, where it may stand,
 * and how to read what is particular to it. A kind added to COMPONENT_KINDS
 * without an entry here does not compile.
 */
import { all, flag, identifier, kindOf, matches, oneOf, optional, points, readArray, readList, readObject, reference, shape, strictKeys, width } from './check.js'
import { MAX_COLUMNS, MAX_NESTING_DEPTH, MAX_REGION_COMPONENTS, MIN_COLUMNS } from './limits.js'
import { at } from './pointer.js'
import { COLOR } from './syntax.js'
import { COMPONENT_KINDS, IMAGE_FITS, IMAGE_SOURCE_KINDS } from './types.js'
import type { Border, ColumnSlot, Component, ComponentBase, ComponentKind, ImageSource, ImageSourceKind, RegionName, Width } from './types.js'
import { resolve, withinPage } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { readExpression, readFieldRef, readInlines, readStyleRef, readStyleRules } from './validate-inline.js'
import { checkFixedWidths, readTable, TABLE_OPTIONAL, TABLE_REQUIRED } from './validate-table.js'

export interface ComponentScope {
  readonly region: RegionName
  /** Where the region is, for the error when its budget runs out. */
  readonly regionPath: string
  /** How many containers enclose the components being read: 0 at a region's top level. */
  readonly depth: number
  /** The innermost columns or keep-together block around the components being read, if any: no table or page break stands in one. */
  readonly layout: ComponentKind | undefined
  /** How many more components the region may hold; one budget for every list in the region. */
  readonly budget: { left: number }
}

/** The regions content flows through; the others are drawn at a fixed place on a page. */
const FLOW_REGIONS: readonly RegionName[] = ['body', 'summary']

const COLOR_RULE = 'a colour written #rrggbb in lower case'

interface KindRule<C extends Component> {
  readonly required: readonly string[]
  readonly optional?: readonly string[]
  /**
   * Holds components of its own: 'layout' when it lays them out (columns,
   * keep-together), 'flow' when they flow as though it were not there (a
   * section). Either counts toward the nesting depth.
   */
  readonly holds?: 'layout' | 'flow'
  /** May stand only in a region content flows through. */
  readonly flowOnly?: true
  /** Is part of the flow itself, so never inside a columns or keep-together block. */
  readonly inFlow?: true
  /**
   * What is particular to the kind. `scope` is the scope of what a
   * container holds, and the component's own for any other kind; the
   * region is the same either way. `base` is undefined when the
   * component's id could not be read.
   */
  readonly read: (c: Ctx, o: Record<string, unknown>, path: string, scope: ComponentScope, base: ComponentBase | undefined) => C | undefined
}

/** The scope a component of `kind` passes to what it holds: one level deeper, and inside it when it lays them out. */
function inside(scope: ComponentScope, kind: ComponentKind, holds: 'layout' | 'flow' | undefined): ComponentScope {
  if (holds === undefined) return scope
  return { ...scope, depth: scope.depth + 1, layout: holds === 'layout' ? kind : scope.layout }
}

function readSlot(c: Ctx, value: unknown, path: string, scope: ComponentScope): { width: Width | undefined; slot: ColumnSlot | undefined } {
  const o = shape(c.f, value, path, ['width', 'components'])
  const slotWidth = width(c.f, o?.width, at(path, 'width'))
  const components = readComponents(c, o?.components, at(path, 'components'), scope)
  return { width: slotWidth, slot: slotWidth === undefined || components === undefined ? undefined : { width: slotWidth, components } }
}

/** A length checked against the page, as `what` measures it. */
function sized(c: Ctx, value: unknown, path: string, side: 'width' | 'height', what: string): number | undefined {
  const length = points(c.f, value, path, 'positive')
  withinPage(c, length, path, side, what)
  return length
}

type SourceReader = (c: Ctx, o: Record<string, unknown>, path: string, region: RegionName) => ImageSource | undefined

const SOURCES: { readonly [K in ImageSourceKind]: { readonly required: readonly string[]; readonly read: SourceReader } } = {
  asset: {
    required: ['asset'],
    read: (c, o, path) => {
      const asset = reference(c.f, o.asset, at(path, 'asset'))
      resolve(c.f, c.declared.assets, asset, at(path, 'asset'), 'unknown-asset', 'asset')
      return asset === undefined ? undefined : { kind: 'asset', asset }
    },
  },
  field: {
    required: ['field'],
    read: (c, o, path, region) => {
      const field = readFieldRef(c, o.field, at(path, 'field'), { region, reads: 'report' })
      if (field?.type !== undefined && field.type !== 'image') {
        c.f.report(at(path, 'field'), 'binding-type-mismatch', `an image draws an image field, and this is a ${field.type}`)
      }
      return field && { kind: 'field', field: field.ref }
    },
  },
}

function readImageSource(c: Ctx, value: unknown, path: string, region: RegionName): ImageSource | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, IMAGE_SOURCE_KINDS)
  if (o === undefined || kind === undefined) return undefined
  strictKeys(c.f, o, path, ['kind', ...SOURCES[kind].required])
  return SOURCES[kind].read(c, o, path, region)
}

function readBorder(c: Ctx, value: unknown, path: string): Border | undefined {
  const o = shape(c.f, value, path, ['thickness', 'color'])
  const thickness = points(c.f, o?.thickness, at(path, 'thickness'), 'positive')
  const color = matches(c.f, o?.color, at(path, 'color'), COLOR, 'invalid-color', COLOR_RULE)
  return thickness === undefined || color === undefined ? undefined : { thickness, color }
}

const KINDS: { readonly [K in ComponentKind]: KindRule<Extract<Component, { kind: K }>> } = {
  text: {
    required: ['content'],
    optional: ['keepWithNext'],
    read: (c, o, path, scope, base) => {
      const content = readInlines(c, o.content, at(path, 'content'), { region: scope.region, reads: 'report' })
      const keepWithNext = flag(c.f, o.keepWithNext, at(path, 'keepWithNext'))
      return base && content && { ...base, kind: 'text', content, ...optional('keepWithNext', keepWithNext) }
    },
  },
  image: {
    required: ['source', 'width', 'height', 'fit'],
    read: (c, o, path, scope, base) => {
      const source = readImageSource(c, o.source, at(path, 'source'), scope.region)
      const imageWidth = sized(c, o.width, at(path, 'width'), 'width', 'this image')
      const height = sized(c, o.height, at(path, 'height'), 'height', 'this image')
      const fit = oneOf(c.f, o.fit, at(path, 'fit'), IMAGE_FITS)
      if (base === undefined || source === undefined || imageWidth === undefined || height === undefined || fit === undefined) return undefined
      return { ...base, kind: 'image', source, width: imageWidth, height, fit }
    },
  },
  line: {
    required: ['thickness'],
    optional: ['color'],
    read: (c, o, path, _scope, base) => {
      const thickness = points(c.f, o.thickness, at(path, 'thickness'), 'positive')
      const color = matches(c.f, o.color, at(path, 'color'), COLOR, 'invalid-color', COLOR_RULE)
      return base && thickness !== undefined ? { ...base, kind: 'line', thickness, ...optional('color', color) } : undefined
    },
  },
  rectangle: {
    required: ['width', 'height'],
    optional: ['fill', 'stroke'],
    read: (c, o, path, _scope, base) => {
      const boxWidth = sized(c, o.width, at(path, 'width'), 'width', 'this rectangle')
      const height = sized(c, o.height, at(path, 'height'), 'height', 'this rectangle')
      const fill = matches(c.f, o.fill, at(path, 'fill'), COLOR, 'invalid-color', COLOR_RULE)
      const stroke = matches(c.f, o.stroke, at(path, 'stroke'), COLOR, 'invalid-color', COLOR_RULE)
      if (base === undefined || boxWidth === undefined || height === undefined) return undefined
      return { ...base, kind: 'rectangle', width: boxWidth, height, ...optional('fill', fill), ...optional('stroke', stroke) }
    },
  },
  spacer: {
    required: ['height'],
    read: (c, o, path, _scope, base) => {
      const height = sized(c, o.height, at(path, 'height'), 'height', 'this spacer')
      return base && height !== undefined ? { ...base, kind: 'spacer', height } : undefined
    },
  },
  columns: {
    required: ['columns'],
    holds: 'layout',
    read: (c, o, path, scope, base) => {
      const where = at(path, 'columns')
      const read = readList(c.f, o.columns, where, MIN_COLUMNS, MAX_COLUMNS)?.map((item, index) => readSlot(c, item, at(where, index), scope))
      if (read !== undefined) checkFixedWidths(c, read.map(({ width: slotWidth }) => slotWidth), where)
      const columns = read && all(read.map(({ slot }) => slot))
      return base && columns && { ...base, kind: 'columns', columns }
    },
  },
  section: {
    required: ['components'],
    optional: ['border', 'fill', 'padding'],
    holds: 'flow',
    read: (c, o, path, scope, base) => {
      const components = readComponents(c, o.components, at(path, 'components'), scope)
      const border = readBorder(c, o.border, at(path, 'border'))
      const fill = matches(c.f, o.fill, at(path, 'fill'), COLOR, 'invalid-color', COLOR_RULE)
      const padding = points(c.f, o.padding, at(path, 'padding'), 'zero')
      return base && components && { ...base, kind: 'section', components, ...optional('border', border), ...optional('fill', fill), ...optional('padding', padding) }
    },
  },
  table: {
    required: TABLE_REQUIRED,
    optional: TABLE_OPTIONAL,
    flowOnly: true,
    inFlow: true,
    read: (c, o, path, scope, base) => readTable(c, o, path, scope.region, base),
  },
  pageBreak: {
    required: [],
    flowOnly: true,
    inFlow: true,
    read: (_c, _o, _path, _scope, base) => base && { ...base, kind: 'pageBreak' },
  },
  keepTogether: {
    required: ['components'],
    holds: 'layout',
    flowOnly: true,
    read: (c, o, path, scope, base) => {
      const components = readComponents(c, o.components, at(path, 'components'), scope)
      return base && components && { ...base, kind: 'keepTogether', components }
    },
  },
}

/** Records a component's id, refusing it when another component already has it. */
function claim(c: Ctx, id: string, path: string): void {
  c.f.component(path, id)
  const first = c.componentIds.get(id)
  if (first === undefined) c.componentIds.set(id, path)
  else c.f.report(at(path, 'id'), 'duplicate-component-id', `"${id}" is already the id of the component at ${first}; component ids are unique across the whole report`)
}

/** Reports a component of `kind` standing where it may not. */
function place(c: Ctx, rule: KindRule<Component>, kind: ComponentKind, path: string, scope: ComponentScope): void {
  if (rule.flowOnly && !FLOW_REGIONS.includes(scope.region)) {
    c.f.report(path, 'misplaced-flow-component', `a ${kind} stands only in the body or the summary, where content flows, not in the ${scope.region}`)
  }
  if (rule.inFlow && scope.layout !== undefined) {
    c.f.report(path, 'nested-flow-component', `a ${kind} is part of the flow, and cannot stand inside a ${scope.layout} block; a section can hold it`)
  }
}

function readComponent(c: Ctx, value: unknown, path: string, scope: ComponentScope): Component | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, COMPONENT_KINDS)
  if (o === undefined || kind === undefined) return undefined
  const rule: KindRule<Component> = KINDS[kind]
  strictKeys(c.f, o, path, ['id', 'kind', ...rule.required], ['visibleWhen', 'style', 'styleWhen', ...(rule.optional ?? [])])
  const id = identifier(c.f, o.id, at(path, 'id'))
  if (id !== undefined) claim(c, id, path)
  place(c, rule, kind, path, scope)
  if (rule.holds !== undefined && scope.depth >= MAX_NESTING_DEPTH) {
    c.f.report(path, 'nesting-too-deep', `this ${kind} is inside ${scope.depth} containers; containers nest at most ${MAX_NESTING_DEPTH} deep`)
    return undefined
  }
  const visibleWhen = readExpression(c.f, o.visibleWhen, at(path, 'visibleWhen'))
  const style = readStyleRef(c, o.style, at(path, 'style'))
  const styleWhen = readStyleRules(c, o.styleWhen, at(path, 'styleWhen'))
  const base = id === undefined ? undefined : { id, ...optional('visibleWhen', visibleWhen), ...optional('style', style), ...optional('styleWhen', styleWhen) }
  return rule.read(c, o, path, inside(scope, kind, rule.holds), base)
}

/** Takes one component from the region's budget, reporting once when it is spent. */
function spend(c: Ctx, scope: ComponentScope): boolean {
  if (scope.budget.left > 0) {
    scope.budget.left -= 1
    return true
  }
  if (scope.budget.left === 0) {
    c.f.report(scope.regionPath, 'too-many', `a region holds at most ${MAX_REGION_COMPONENTS} components, counting those inside containers`)
    scope.budget.left = -1
  }
  return false
}

export function readComponents(c: Ctx, value: unknown, path: string, scope: ComponentScope): readonly Component[] | undefined {
  const items = readArray(c.f, value, path, MAX_REGION_COMPONENTS)
  if (items === undefined) return undefined
  const components: (Component | undefined)[] = []
  for (const [index, item] of items.entries()) {
    if (!spend(c, scope)) return undefined
    components.push(readComponent(c, item, at(path, index), scope))
  }
  return all(components)
}
