/**
 * What an approved SVG may hold, as tables: the elements kept and the
 * geometry each is written with, the properties kept and the order they are
 * written in, and what is removed or refused instead (0030).
 *
 * Tables, not switches, so that the tests derive what they check from them:
 * the differential test reads every cleaned drawing back with another
 * parser and finds each element and attribute here, never by searching the
 * output for a phrase. Anything a table does not name is refused, named:
 * an SVG is untrusted input, and a construct this file has not decided
 * about fails closed (formancy.ai 0022).
 *
 * The lists are svg-to-pdfkit's subset, the converter pdfmake 0.3.11
 * vendors, cut down to what it draws as a browser draws it. Where the two
 * disagree -- text in a font pdfmake picks, a filter drawn as nothing -- the
 * construct is refused rather than drawn otherwise than its author saw it.
 * Every `source.js:N` cited in the SVG reader's files is a line of pdfmake
 * 0.3.11's `src/3rd-party/svg-to-pdfkit/source.js`; Node runs a transpiled
 * copy of it under `js/`, and the browser build bundles it.
 */

/** The elements a cleaned drawing is written with. */
export const KEPT_ELEMENTS = [
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
] as const
export type KeptElement = (typeof KEPT_ELEMENTS)[number]

const KEPT_SET: ReadonlySet<string> = new Set(KEPT_ELEMENTS)

export function isKept(name: string): name is KeptElement {
  return KEPT_SET.has(name)
}

export const SHAPES: ReadonlySet<KeptElement> = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])
export const GRADIENTS: ReadonlySet<KeptElement> = new Set(['linearGradient', 'radialGradient'])

/**
 * Each kept element's geometry, in the order it is written. The root's
 * viewBox is the drawing's own coordinates; every other root attribute is
 * the report's to decide (its box, its fit) and is removed.
 */
export const GEOMETRY: { readonly [E in KeptElement]: readonly string[] } = {
  svg: ['viewBox'],
  g: [],
  defs: [],
  path: ['d'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  linearGradient: ['x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform', 'spreadMethod'],
  radialGradient: ['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform', 'spreadMethod'],
  stop: ['offset'],
  clipPath: ['clipPathUnits'],
}

/** The elements that may carry a `transform`, written after the geometry. A gradient's is its gradientTransform. */
export const TRANSFORMED: ReadonlySet<KeptElement> = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'clipPath'])

const CONTAINER_CHILDREN: ReadonlySet<KeptElement> = new Set([
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'clipPath',
])
const NOTHING: ReadonlySet<KeptElement> = new Set()

/**
 * What each kept element may hold. A clip path holds shapes alone, as SVG
 * says, and a gradient its stops alone; a shape holds nothing that draws.
 * svg-to-pdfkit would draw a group inside a clip path, which a browser
 * ignores, so the table, not the converter, decides.
 */
export const CHILDREN: { readonly [E in KeptElement]: ReadonlySet<KeptElement> } = {
  svg: CONTAINER_CHILDREN,
  g: CONTAINER_CHILDREN,
  defs: CONTAINER_CHILDREN,
  path: NOTHING,
  rect: NOTHING,
  circle: NOTHING,
  ellipse: NOTHING,
  line: NOTHING,
  polyline: NOTHING,
  polygon: NOTHING,
  linearGradient: new Set(['stop']),
  radialGradient: new Set(['stop']),
  stop: NOTHING,
  clipPath: SHAPES,
}

/**
 * Removed with everything inside them, and listed: what describes, scripts
 * or animates a drawing and never draws. The drawing printed is the one
 * before any animation starts, which is what a still page shows.
 */
export const REMOVED_ELEMENTS: ReadonlySet<string> = new Set([
  'title',
  'desc',
  'metadata',
  'script',
  'animate',
  'animateMotion',
  'animateTransform',
  'animateColor',
  'set',
  'mpath',
  'discard',
  'cursor',
  'view',
])

export interface RefusedElement {
  readonly code: 'text' | 'raster' | 'reference' | 'unsupported'
  readonly advice: string
}

/** Refused, with the code and what to do about it. Any SVG element neither kept, removed nor listed here is refused too, named. */
export const REFUSED_ELEMENTS: ReadonlyMap<string, RefusedElement> = new Map<string, RefusedElement>([
  ...['text', 'tspan', 'textPath', 'tref', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'glyphRef'].map(
    (name): [string, RefusedElement] => [name, { code: 'text', advice: 'convert the text to outlines' }],
  ),
  ['image', { code: 'raster', advice: 'add the picture as a PNG or JPEG asset of its own' }],
  ['use', { code: 'reference', advice: 'a program wrote shapes as references; save it again through a program that expands them' }],
  ['symbol', { code: 'reference', advice: 'a program wrote shapes as references; save it again through a program that expands them' }],
  ['switch', { code: 'unsupported', advice: "save it without Illustrator's editing capabilities" }],
  ['foreignObject', { code: 'unsupported', advice: "save it without Illustrator's editing capabilities" }],
  ['filter', { code: 'unsupported', advice: 'expand the appearance' }],
  ['mask', { code: 'unsupported', advice: 'flatten the transparency' }],
  ['pattern', { code: 'unsupported', advice: 'expand the pattern into shapes' }],
  ['marker', { code: 'unsupported', advice: 'expand the stroke' }],
])

/** The root's attributes the report decides instead: its box gives the size, its fit the proportions and the clipping. Removed and listed. */
export const ROOT_REMOVED: ReadonlySet<string> = new Set([
  'width',
  'height',
  'x',
  'y',
  'version',
  'baseProfile',
  'preserveAspectRatio',
  'zoomAndPan',
  'contentScriptType',
  'contentStyleType',
])

/** Removed from any kept element and listed: what a person, a screen reader or a script reads, never the page. */
const REMOVED_ATTRIBUTES: ReadonlySet<string> = new Set(['role', 'tabindex', 'focusable', 'lang'])

export function isRemovedAttribute(name: string): boolean {
  return REMOVED_ATTRIBUTES.has(name) || name.startsWith('data-') || name.startsWith('aria-') || /^on[a-z]+$/.test(name)
}

/** A link's own attributes, removed with the link when an `a` is read as the group it draws as. */
export const LINK_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'target', 'download', 'rel', 'hreflang', 'type', 'ping', 'referrerpolicy'])

/**
 * Refused: a browser may hide the element by them, even outside a `switch`
 * (SVG 1.1, 5.8), so removing them would print what the approver never saw.
 */
export const CONDITIONAL_ATTRIBUTES: ReadonlySet<string> = new Set(['requiredFeatures', 'requiredExtensions', 'systemLanguage', 'requiredFonts', 'requiredFormats'])

/** The properties written, in the order they are written: the canonical order. */
export const WRITTEN_PROPERTIES = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'clip-path',
  'clip-rule',
  'stop-color',
  'stop-opacity',
] as const
export type WrittenProperty = (typeof WRITTEN_PROPERTIES)[number]

/** What a stop draws with: its colour and its opacity. */
const STOP_PAINT: ReadonlySet<WrittenProperty> = new Set(['stop-color', 'stop-opacity'])

/** What a group or a shape draws with, or passes on to what it holds: every written property but a stop's. */
const PAINT: ReadonlySet<WrittenProperty> = new Set(WRITTEN_PROPERTIES.filter((property) => !STOP_PAINT.has(property)))

const NO_PROPERTY: ReadonlySet<WrittenProperty> = new Set()

/**
 * The properties a cleaned drawing writes on each element: what draws there,
 * in a browser and in the converter alike. Anything else is removed from the
 * element and listed, a reference among them, which nothing would follow.
 *
 * - The root holds its namespace and its viewBox alone; its paint is moved
 *   onto a group inside it (0030).
 * - A gradient element draws nothing itself, and its stops take nothing
 *   from it, in a browser or in the converter.
 * - A clip path's shapes are painted as its clip, in no colour, so of what
 *   it could pass on only `clip-rule` matters. They inherit it from what
 *   holds the clip path, in a browser and in the converter, which reads a
 *   clip path's parents from the document (`source.js:1208`); the cleaner
 *   writes the rule a clip path inherits on the clip path itself, so that
 *   the clip it makes never rests on `defs`, and what `defs` holds draws
 *   nowhere.
 */
export const WRITTEN_ON: { readonly [E in KeptElement]: ReadonlySet<WrittenProperty> } = {
  svg: NO_PROPERTY,
  g: PAINT,
  defs: NO_PROPERTY,
  path: PAINT,
  rect: PAINT,
  circle: PAINT,
  ellipse: PAINT,
  line: PAINT,
  polyline: PAINT,
  polygon: PAINT,
  linearGradient: NO_PROPERTY,
  radialGradient: NO_PROPERTY,
  stop: STOP_PAINT,
  clipPath: new Set(['clip-rule']),
}

/**
 * Read and never written: `display: none` removes the element, `color` is
 * resolved into every `currentColor`, and `visibility` and `vector-effect`
 * are accepted only with the value that draws as though they were absent.
 */
export const READ_PROPERTIES = ['display', 'visibility', 'color', 'vector-effect'] as const
export type Property = WrittenProperty | (typeof READ_PROPERTIES)[number]

const PROPERTY_SET: ReadonlySet<string> = new Set([...WRITTEN_PROPERTIES, ...READ_PROPERTIES])

function isProperty(name: string): name is Property {
  return PROPERTY_SET.has(name)
}

/** The kept properties a child takes from its parent when it sets none of its own (SVG 1.1's property index). */
export const INHERITED: ReadonlySet<Property> = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'clip-rule',
  'color',
  'visibility',
])

/**
 * Removed wherever they are written, as an attribute, in `style` or in a
 * stylesheet, and listed: rendering hints a PDF has no use for, the
 * properties of text (refused, so they apply to nothing), and properties
 * nothing kept reads.
 */
const REMOVED_PROPERTIES: ReadonlySet<string> = new Set([
  'shape-rendering',
  'color-rendering',
  'color-interpolation',
  'color-interpolation-filters',
  'image-rendering',
  'text-rendering',
  'buffered-rendering',
  'color-profile',
  'enable-background',
  'isolation',
  'overflow',
  'pointer-events',
  'cursor',
  'solid-color',
  'solid-opacity',
  'flood-color',
  'flood-opacity',
  'lighting-color',
  'font',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-variant-caps',
  'font-variant-east-asian',
  'font-variant-ligatures',
  'font-variant-numeric',
  'font-variant-position',
  'font-variant-alternates',
  'font-weight',
  'font-feature-settings',
  'font-variation-settings',
  'font-kerning',
  'font-optical-sizing',
  'font-synthesis',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'text-align',
  'text-align-last',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-indent',
  'text-orientation',
  'text-transform',
  'text-overflow',
  'writing-mode',
  'direction',
  'unicode-bidi',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'line-height',
  'white-space',
  'glyph-orientation-vertical',
  'glyph-orientation-horizontal',
  'kerning',
  'inline-size',
  'shape-inside',
  'shape-padding',
  'shape-margin',
  'shape-subtract',
])

/**
 * Removed only with the value that does nothing, and refused with any other,
 * with what to do: a filter, a mask, a marker or a blend this format does
 * not draw, a stroke painted under its fill, a transform about another
 * origin.
 */
interface Inert {
  readonly inert: (value: string) => boolean
  readonly advice: string
}

const INERT: ReadonlyMap<string, Inert> = new Map<string, Inert>([
  ['filter', { inert: (value: string) => value === 'none', advice: 'expand the appearance' }],
  ['mask', { inert: (value: string) => value === 'none', advice: 'flatten the transparency' }],
  ['mix-blend-mode', { inert: (value: string) => value === 'normal', advice: 'flatten the transparency' }],
  ...['marker', 'marker-start', 'marker-mid', 'marker-end'].map((name): [string, Inert] => [name, { inert: (value: string) => value === 'none', advice: 'expand the stroke' }]),
  ['paint-order', { inert: fillBeforeStroke, advice: 'paint the fill before the stroke' }],
  ['transform-origin', { inert: (value: string) => ORIGINS.has(value), advice: 'apply the transform about the origin' }],
])

/** `transform-origin` values that are the origin SVG takes anyway. */
const ORIGINS: ReadonlySet<string> = new Set(['0', '0 0', '0 0 0', '0px', '0px 0px', '0px 0px 0px', '0% 0%', 'left top', 'top left'])

/** Whether a `paint-order` keeps the fill under the stroke, as SVG paints by default: `normal`, or a list that names stroke after fill or not at all. */
function fillBeforeStroke(value: string): boolean {
  if (value === 'normal') return true
  const order = value.split(/\s+/)
  const known = ['fill', 'stroke', 'markers']
  if (order.some((part) => !known.includes(part)) || new Set(order).size !== order.length) return false
  for (const part of known) if (!order.includes(part)) order.push(part)
  return order.indexOf('fill') < order.indexOf('stroke')
}

/** What happens to a property written on a kept element, whose value is its text trimmed and in lower case. */
export type PropertyFate =
  | { readonly fate: 'kept'; readonly property: Property }
  | { readonly fate: 'removed' }
  | { readonly fate: 'refused'; readonly advice: string }

export function propertyFate(name: string, value: string): PropertyFate | undefined {
  if (isProperty(name)) return { fate: 'kept', property: name }
  if (REMOVED_PROPERTIES.has(name) || (name.startsWith('-') && !name.startsWith('--'))) return { fate: 'removed' }
  const inert = INERT.get(name)
  if (inert !== undefined) return inert.inert(value) ? { fate: 'removed' } : { fate: 'refused', advice: inert.advice }
  return undefined
}
