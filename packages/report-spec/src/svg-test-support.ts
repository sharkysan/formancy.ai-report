/**
 * Test support for the SVG cleaner (0030): bytes in and out without a
 * `TextEncoder`, which report-spec's ES2023 library does not have; the
 * cleaned drawing read back by saxes, a parser that is not the writer; and
 * a seeded, deterministic stream of mutated drawings for the fixed point.
 */
import { SaxesParser } from 'saxes'
import type { CleanSvg } from './svg.js'
import { cleanSvg } from './svg.js'
import type { SvgRefusal } from './svg-refusal.js'

/**
 * The time a cleaning that is linear in its input stays under, and one
 * that grows with its square does not. On 18 October 2026, on an Intel
 * i9-10900K under Node 24.21.0, a mebibyte of each shape in
 * `svg-threats.test.ts` cleaned in 35 to 120 ms, medians of five. Before
 * they were fixed, 32,000 digits of an rgb() percentage, or zeros of one
 * number, took 0.75 to 0.88 s, four times as long for each doubling -- a
 * mebibyte would have taken minutes -- and the chain of clip paths in
 * `svg-elements.test.ts` 2.5 s. The ceiling is about twelve times the
 * slowest linear cleaning, so that a runner a few times slower passes.
 */
export const CEILING_MS = 1500

/** A text as UTF-8 bytes, as a file a person saves is written. */
export function utf8(text: string): Uint8Array {
  const bytes: number[] = []
  for (const character of text) {
    const code = character.codePointAt(0) as number
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(bytes)
}

/** ASCII bytes as text: what the cleaner writes. */
export function ascii(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return text
}

/** The cleaned drawing of `svg`, failing the test with the refusal when it is refused. */
export function cleaned(svg: string | Uint8Array): CleanSvg & { readonly text: string } {
  const result = cleanSvg(typeof svg === 'string' ? utf8(svg) : svg)
  if (!result.ok) throw new Error(`refused ${result.code}: ${result.message}`)
  return { ...result, text: ascii(result.bytes) }
}

/** The refusal of `svg`, failing the test when it is accepted. */
export function refused(svg: string | Uint8Array): SvgRefusal {
  const result = cleanSvg(typeof svg === 'string' ? utf8(svg) : svg)
  if (result.ok) throw new Error(`accepted: ${ascii(result.bytes)}`)
  return result
}

/** A drawing of `inner` in the SVG namespace, 100 units square. */
export function svg(inner: string, root = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${root}>${inner}</svg>`
}

export interface ReadElement {
  readonly name: string
  readonly prefix: string
  readonly uri: string
  readonly attributes: ReadonlyArray<{ readonly name: string; readonly prefix: string; readonly uri: string; readonly value: string }>
  readonly children: ReadElement[]
}

/** What saxes reads in a cleaned drawing: its elements and attributes, namespaces resolved, and every other kind of node it met. */
export function readBack(text: string): { readonly root: ReadElement; readonly others: readonly string[] } {
  const parser = new SaxesParser({ xmlns: true })
  const stack: ReadElement[] = []
  const others: string[] = []
  let root: ReadElement | undefined
  let failure: Error | undefined
  parser.on('error', (error) => {
    failure ??= error
  })
  parser.on('opentag', (tag) => {
    const element: ReadElement = {
      name: tag.local,
      prefix: tag.prefix,
      uri: tag.uri,
      attributes: Object.values(tag.attributes).map(({ local, prefix, uri, value }) => ({ name: local, prefix, uri, value })),
      children: [],
    }
    stack.at(-1)?.children.push(element)
    root ??= element
    stack.push(element)
  })
  parser.on('closetag', () => {
    stack.pop()
  })
  parser.on('text', () => others.push('text'))
  parser.on('comment', () => others.push('comment'))
  parser.on('processinginstruction', () => others.push('processing instruction'))
  parser.on('doctype', () => others.push('doctype'))
  parser.on('cdata', () => others.push('cdata'))
  parser.on('xmldecl', () => others.push('declaration'))
  parser.write(text).close()
  if (failure !== undefined) throw failure
  if (root === undefined) throw new Error('saxes read no element')
  return { root, others }
}

/** A seeded generator, so that a thousand mutations are the same thousand on every run. */
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NUMBERS = ['0', '1', '-1', '12.5', '.5', '-.25', '1e2', '1.5e-3', '2E1', '0.000000123', '999999', '1000001', '7.123456789123', '-0', '3.']
const COLOURS = ['#abc', '#A1B2C3', 'rgb(1, 2, 3)', 'rgb(10%,20%,30%)', 'teal', 'CurrentColor', 'transparent', 'hsl(1,2%,3%)', 'none', 'url(#nowhere)']
const ATTRIBUTES = [
  'opacity="0.5"',
  'fill-opacity="50%"',
  'stroke="#123456"',
  'stroke-width="2mm"',
  'stroke-dasharray="1 2 3"',
  'stroke-linejoin="round"',
  'transform="rotate(30 5 5)"',
  'transform="translate(1e3)"',
  'data-x="y"',
  'onclick="z()"',
  'style="fill:red;-x-y:z"',
  'class="k"',
  'display="none"',
  'paint-order="stroke"',
  'shape-rendering="crispEdges"',
  'font-family="x"',
  'clip-path="url(#c)"',
  'fill="url(#g)"',
  'mask="none"',
  'visibility="hidden"',
  'xml:space="preserve"',
  'aria-label="q"',
]
const ELEMENTS = [
  '<!-- a comment -->',
  '<title>t</title>',
  '<metadata><x:a xmlns:x="urn:x"/></metadata>',
  '<style>.k{fill:#123;stroke-width:3}</style>',
  '<linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue" stop-opacity=".5"/></linearGradient>',
  '<clipPath id="c"><rect width="50" height="50"/></clipPath>',
  '<rect width="10" height="10" rx="2"/>',
  '<path d="m1 1h5v5z"/>',
  '<text>x</text>',
  '<g><circle r="3"/></g>',
]

/** One mutation of `text`: a number, a command, a colour, an attribute or an element changed, added or broken. */
function mutate(text: string, next: () => number): string {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
  const at = (pattern: RegExp): RegExpExecArray | undefined => {
    const all = [...text.matchAll(pattern)]
    return all.length === 0 ? undefined : pick(all)
  }
  const replace = (match: RegExpExecArray | undefined, by: string): string =>
    match === undefined ? text : text.slice(0, match.index) + by + text.slice(match.index + match[0].length)
  switch (Math.floor(next() * 9)) {
    case 0:
      return replace(at(/-?\d*\.?\d+(?:e-?\d+)?/gi), pick(NUMBERS))
    case 1: {
      const letter = at(/(?<=d="[^"]*)[MLHVCSQTAZmlhvcsqtaz]/g)
      return replace(letter, letter === undefined ? '' : letter[0] === letter[0].toLowerCase() ? letter[0].toUpperCase() : letter[0].toLowerCase())
    }
    case 2:
      return replace(at(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g), pick(COLOURS))
    case 3: {
      // Every element a drawing may write, gradients, stops, clip paths and defs among them: what is written on each is held to its own list.
      const element = /<(?:rect|path|circle|g|polyline|ellipse|line|polygon|stop|linearGradient|radialGradient|clipPath|defs)\b/g
      return replace(at(element), `${at(element)?.[0] ?? '<g'} ${pick(ATTRIBUTES)}`)
    }
    case 4:
      return replace(at(/<\/svg>/g), `${pick(ELEMENTS)}</svg>`)
    case 5: {
      const shape = at(/<(?:rect|path|circle|polyline|ellipse|line|polygon)\b[^>]*\/>/g)
      return replace(shape, shape === undefined ? '' : `<g transform="scale(${pick(NUMBERS)})">${shape[0]}</g>`)
    }
    case 6:
      return replace(at(/[ ,]/g), pick([' ', ',', ' , ', '\n\t', '', ',,']))
    case 7: {
      const start = Math.floor(next() * text.length)
      return text.slice(0, start) + text.slice(start + 1 + Math.floor(next() * 3))
    }
    default:
      return replace(at(/<(?:rect|circle|path)\b[^>]*\/>/g), `${at(/<(?:rect|circle|path)\b[^>]*\/>/g)?.[0] ?? ''}`.repeat(2))
  }
}

/** `count` drawings, each a seeded run of one to four mutations of one of `bases`. */
export function mutations(bases: readonly string[], count: number, seed: number): string[] {
  const next = random(seed)
  const out: string[] = []
  for (let i = 0; i < count; i += 1) {
    let text = bases[i % bases.length] as string
    const steps = 1 + Math.floor(next() * 4)
    for (let step = 0; step < steps; step += 1) text = mutate(text, next)
    out.push(text)
  }
  return out
}
