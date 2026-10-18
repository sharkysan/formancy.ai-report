import type { PagePixels } from '@formancy/report-corpus'
import { cleanSvg, type ImageAsset, type SvgRefusalCode } from '@formancy/report-runtime'

/**
 * SVGs for the renderer's tests (0030), each written as an author or a
 * drawing program writes one -- relative path data, short colours, styles,
 * an editor's leftovers -- and approved the way a host approves one, by
 * report-spec's `cleanSvg`, which the runtime hands on: drawings it accepts,
 * hazards it refuses or removes, and a seeded stream of mutations of the
 * drawings. report-spec states its own small case for each rule; what is
 * here is what the renderer draws, or must never hand pdfmake.
 */

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** A drawing of `inner`, its viewBox `viewBox`, with `root`'s attributes. */
export function svg(inner: string, viewBox = '0 0 100 100', root = ''): string {
  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="${viewBox}"${root}>${inner}</svg>`
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

/** An asset of `bytes` as a host hands one over, declared an SVG and never cleaned. */
export function rawSvgAsset(bytes: string | Uint8Array, id = 'mark'): ImageAsset {
  return { id, mediaType: 'image/svg+xml', bytes: typeof bytes === 'string' ? utf8(bytes) : bytes }
}

/** An approved SVG asset: what `cleanSvg` writes of `text`, failing the test when it is refused. */
export function svgAsset(text: string, id = 'mark'): ImageAsset {
  const cleaned = cleanSvg(utf8(text))
  if (!cleaned.ok) throw new Error(`cleanSvg refused the drawing ${id} as ${cleaned.code}: ${cleaned.message}`)
  return { id, mediaType: 'image/svg+xml', bytes: cleaned.bytes }
}

/** The colours of `MARK`, as the cleaner writes them. */
export const MARK_COLOURS = { disc: '#1f4e79', white: '#ffffff' } as const

/** An invented mark: a deep-blue disc, a white gable stroked over a white drop, 120 units square. */
export const MARK = svg(
  '<circle cx="60" cy="60" r="56" fill="#1F4E79"/>' +
    '<path d="M28 62l32-30 32 30" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M60 54c10 14 14 22 14 28a14 14 0 0 1-28 0c0-6 4-14 14-28z" fill="white"/>',
  '0 0 120 120',
)

/**
 * Drawings the cleaner accepts, each written as one program or person
 * writes one, together holding every kind of element, reference, paint and
 * transform a cleaned drawing may: what the renderer must draw through the
 * converter's throwing callbacks without a warning.
 */
export const DRAWINGS: { readonly [name: string]: string } = {
  mark: MARK,
  shapes: svg(
    '<rect x="5" y="5" width="40" height="20" rx="4" ry="2" fill="#2a6f97"/>' +
      '<ellipse cx="75" cy="15" rx="20" ry="10" fill="none" stroke="#14213d" stroke-width="1.5" stroke-dasharray="4 2 1" stroke-dashoffset="3"/>' +
      '<line x1="5" y1="35" x2="95" y2="35" stroke="#e76f51" stroke-width="3" stroke-linecap="square"/>' +
      '<polyline points="5,45 20,60 35,45 50,60" fill="none" stroke="#264653" stroke-linejoin="miter" stroke-miterlimit="8"/>' +
      '<polygon points="60 45 95 45 78 70" fill="#e9c46a" fill-rule="evenodd"/>' +
      '<path d="M5 75h20v10H5zm30 0q10-10 20 0t20 0s10 10 20 0" fill="#2a9d8f" stroke="#264653" stroke-width="0.5"/>' +
      '<path d="M5 95c5-10 10 0 15-5S30 95 35 90" fill="none" stroke="#000" stroke-linejoin="bevel"/>',
  ),
  gradients: svg(
    '<defs>' +
      '<linearGradient id="base" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1f4e79"/><stop offset="50%" stop-color="#4a90c2"/><stop offset="100%" stop-color="rgb(200, 230, 250)"/></linearGradient>' +
      '<linearGradient id="turned" href="#base" gradientTransform="rotate(30 .5 .5)"/>' +
      '<linearGradient id="user" gradientUnits="userSpaceOnUse" x1="10" y1="60" x2="90" y2="90" xlink:href="#base" xmlns:xlink="http://www.w3.org/1999/xlink"/>' +
      '<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5" fx="0.4" fy="0.4"><stop offset=".2" stop-color="#fff"/><stop offset="1" stop-color="#e76f51" stop-opacity="0.4"/></radialGradient>' +
      '</defs>' +
      '<rect x="5" y="5" width="90" height="20" fill="url(#base)"/>' +
      '<rect x="5" y="30" width="90" height="20" fill="url(#turned)" stroke="url(#base)" stroke-width="2"/>' +
      '<circle cx="30" cy="75" r="20" fill="url(#glow)"/>' +
      '<rect x="55" y="60" width="40" height="35" fill="url(#user)"/>',
  ),
  clips: svg(
    '<defs>' +
      '<clipPath id="window"><rect x="10" y="10" width="80" height="35"/><circle cx="50" cy="70" r="20" transform="scale(1 0.9)"/></clipPath>' +
      '<clipPath id="half" clipPathUnits="objectBoundingBox"><path d="M0 0H.5V1H0z" clip-rule="evenodd"/></clipPath>' +
      '</defs>' +
      '<g clip-path="url(#window)"><rect width="100" height="100" fill="#264653"/><path d="M0 100L100 0" stroke="#e9c46a" stroke-width="6"/></g>' +
      '<ellipse cx="80" cy="85" rx="15" ry="10" fill="#e76f51" clip-path="url(#half)"/>',
  ),
  styles: svg(
    '<style>.ink{fill:#14213D}#accent{fill:#fca311;stroke:currentColor;stroke-width:2}path.thin{stroke-width:.5;stroke:#000}</style>' +
      '<g color="#e5e5e5" transform="translate(50 50) rotate(15) scale(.9) skewX(5)">' +
      '<rect class="ink" x="-40" y="-40" width="30" height="30"/>' +
      '<circle id="accent" cx="20" cy="-20" r="15"/>' +
      '<path class="ink thin" d="M-40 10L40 10L0 40Z" style="fill:#e5e5e5;fill-opacity:0.75"/>' +
      '</g>' +
      '<g opacity="0.8"><rect x="80" y="80" width="15" height="15" fill="#000" transform="matrix(1 0 0 1 0 0)"/></g>',
  ),
  'figma-like': svg('<path d="M10 50C10 27.9 27.9 10 50 10s40 17.9 40 40-17.9 40-40 40S10 72.1 10 50Z" stroke="#1F4E79" stroke-width="6"/><path d="M30 55l15 15 25-30" stroke="#1F4E79" stroke-width="6"/>', '0 0 100 100', ' width="100" height="100" fill="none"'),
  'affinity-like': svg(
    // Both rings run the same way round: only the root's even-odd rule leaves the hole in the middle.
    '<path d="M50 5A45 45 0 1 1 49.99 5ZM50 25A25 25 0 1 1 49.99 25Z" style="fill:rgb(31,78,121);"/>',
    '0 0 100 100',
    ' width="100%" height="100%" version="1.1" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"',
  ),
  'illustrator-like':
    '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: an invented exporter -->\n' +
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
    `<svg version="1.1" id="Ebene_1" xmlns="${SVG_NAMESPACE}" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="40mm" height="20mm" viewBox="0 0 200 100" style="enable-background:new 0 0 200 100;" xml:space="preserve">\n` +
    '<title>Mark</title><metadata><x:info xmlns:x="urn:example">Bäckerei</x:info></metadata>\n' +
    '<a href="https://example.invalid/home"><rect x="10" y="10" width="80" height="80" data-name="Box" fill="#1F4E79"/></a>\n' +
    '<g display="none"><rect width="200" height="100" fill="red"/></g>\n' +
    '<path d="M110,90 L150,10 L190,90 Z" fill="#E9C46A" onclick="alert(1)" aria-label="peak"/>\n</svg>\n',
}

/** A hazard of an SVG as it comes, and what the cleaner does with it: refuses it with a code, or removes what is dangerous and accepts the rest. */
export interface SvgThreat {
  readonly name: string
  readonly bytes: Uint8Array
  /** cleanSvg's refusal, or `removed` when it cleans the hazard away and accepts the drawing. */
  readonly outcome: SvgRefusalCode | 'removed'
  /** What no refusal may repeat: the value that made the file dangerous. */
  readonly secrets: readonly string[]
}

const RECT = '<rect width="10" height="10" fill="#000"/>'
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"'

/**
 * One SVG for each hazard 0030 found in pdfmake's converter, and one for
 * each refusal code: what the converter would do with it as it came is the
 * comment above each, and the renderer must refuse every one of them as it
 * came, before pdfmake runs.
 */
const THREATS: readonly (Omit<SvgThreat, 'bytes'> & { readonly text: string | Uint8Array })[] = [
  // It opens an <image>'s file past pdfmake's local access policy, and embeds a data: image unchecked.
  { name: 'a local image', text: svg('<image href="C:/Windows/win.ini" width="10" height="10"/>'), outcome: 'raster', secrets: ['Windows', 'win.ini'] },
  { name: 'a local image by xlink:href', text: svg(`<image ${XLINK} xlink:href="/etc/passwd" width="10" height="10"/>`), outcome: 'raster', secrets: ['passwd'] },
  { name: 'an embedded image', text: svg('<image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/>'), outcome: 'raster', secrets: ['base64', 'iVBOR'] },
  // It draws text in a font pdfmake picks, past the glyph check.
  { name: 'text in CJK', text: svg('<text x="10" y="10">AB山田</text>'), outcome: 'text', secrets: ['AB', '山田'] },
  // It reads a style sheet, an import in it, and a style sheet named by a processing instruction.
  { name: 'an imported style sheet', text: svg(`<style>@import url(https://example.invalid/steal.css);</style>${RECT}`), outcome: 'unsupported', secrets: ['example', 'steal'] },
  { name: 'an external style sheet', text: `<?xml-stylesheet type="text/css" href="https://example.invalid/steal.css"?>${svg(RECT)}`, outcome: 'unsupported', secrets: ['example', 'steal'] },
  // Entities: an external one, and one nothing declares.
  { name: 'a DOCTYPE declaring an entity', text: `<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]>${svg('<rect width="1" height="1" fill="&secret;"/>')}`, outcome: 'doctype', secrets: ['passwd', 'file:'] },
  { name: 'an undeclared entity', text: svg('<rect width="1" height="1" fill="&ext;"/>'), outcome: 'doctype', secrets: ['ext;'] },
  // It follows a gradient cycle until its stack overflows, and fans `use` out until the process dies.
  { name: 'a gradient cycle', text: svg('<linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/><rect width="1" height="1" fill="url(#a)"/>'), outcome: 'reference', secrets: [] },
  {
    name: 'a use fan-out',
    text: svg(`<defs><rect id="r0" width="1" height="1"/>${Array.from({ length: 6 }, (_, i) => `<g id="r${i + 1}">${`<use href="#r${i}"/>`.repeat(10)}</g>`).join('')}</defs><use href="#r6"/>`),
    outcome: 'reference',
    secrets: [],
  },
  // PDFKit throws `unsupported number: 1e+30`, naming nothing.
  { name: 'a number PDFKit throws at', text: svg('<rect width="1e30" height="1"/>'), outcome: 'out-of-range', secrets: ['1e30', '1e+30'] },
  // A reference out of the file would need a document callback.
  { name: 'a paint from an address', text: svg('<rect width="1" height="1" fill="url(https://example.invalid/a.svg#g)"/>'), outcome: 'reference', secrets: ['example', 'a.svg'] },
  // What a browser draws and the converter does not.
  { name: 'a foreign object', text: svg('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">secret</div></foreignObject>'), outcome: 'unsupported', secrets: ['secret'] },
  { name: 'a filter', text: svg(`<filter id="f"><feGaussianBlur stdDeviation="2"/></filter><rect width="10" height="10" filter="url(#f)"/>`), outcome: 'unsupported', secrets: [] },
  // Its reader and its drawing recurse; 5,000 levels overflowed the stack.
  { name: 'forty levels', text: svg(`${'<g>'.repeat(40)}${RECT}${'</g>'.repeat(40)}`), outcome: 'too-deep', secrets: [] },
  { name: 'five thousand levels', text: svg(`${'<g>'.repeat(5000)}${RECT}${'</g>'.repeat(5000)}`), outcome: 'too-deep', secrets: [] },
  // What is not an SVG at all, or not one in an encoding every reader reads alike.
  { name: 'HTML', text: '<html><body>secret</body></html>', outcome: 'not-svg', secrets: ['secret'] },
  { name: 'unclosed markup', text: `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 10 10"><g>${RECT}</svg>`, outcome: 'not-well-formed', secrets: [] },
  { name: 'UTF-16', text: Uint8Array.from([0xff, 0xfe, ...[...svg(RECT)].flatMap((character) => [character.charCodeAt(0), 0])]), outcome: 'encoding', secrets: [] },
  { name: 'a mebibyte and a byte', text: svg(`<!--${' '.repeat(1_048_576)}-->${RECT}`), outcome: 'too-large', secrets: [] },
  // Removed, not refused: what never draws, and a link, whose address the converter would write into the PDF as an annotation.
  { name: 'a javascript link', text: svg(`<a href="javascript:app.alert('secret')">${RECT}</a>`), outcome: 'removed', secrets: ['javascript', 'alert', 'secret'] },
  { name: 'a script and a handler', text: svg(`<script>alert('secret')</script><rect width="10" height="10" onclick="alert('secret')"/>`), outcome: 'removed', secrets: ['alert', 'secret'] },
  { name: 'metadata, a title and a comment', text: `<?xml version="1.0"?><!-- secret -->${svg(`<title>secret</title><metadata>secret</metadata>${RECT}`)}`, outcome: 'removed', secrets: ['secret'] },
]

export const SVG_THREATS: readonly SvgThreat[] = THREATS.map(({ text, ...threat }) => ({ ...threat, bytes: typeof text === 'string' ? utf8(text) : text }))

/** A seeded generator, so that every run renders the same mutations. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Values that take the converter to its edges: no size, a negative one, the largest and smallest a cleaned drawing holds, a turn of no area. */
const EDGES = ['0', '-1', '-0.5', '1e-7', '0.000001', '999999', '1e6', '.5', '100', '3e2', '-999999', '7.25']
const SETTINGS = [
  'opacity="0"',
  'opacity="0.5"',
  'fill-opacity="0"',
  'stroke="#123456"',
  'stroke-width="0"',
  'stroke-width="25"',
  'stroke-dasharray="0 1"',
  'stroke-dasharray="0.5"',
  'stroke-dashoffset="-3"',
  'stroke-miterlimit="1"',
  'stroke-linejoin="miter"',
  'transform="scale(0)"',
  'transform="scale(1 0)"',
  'transform="skewX(89.9)"',
  'transform="rotate(-720 5 5)"',
  'transform="matrix(0 0 0 0 0 0)"',
  'fill="none"',
  'fill="currentColor"',
  'clip-path="url(#window)"',
  'clip-rule="evenodd"',
  'fill="url(#glow)"',
  'stroke="url(#base)"',
]

/** One mutation of `text`: a number at an edge, a setting added to a shape, or a shape doubled. */
function mutate(text: string, next: () => number): string {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
  const at = (pattern: RegExp): RegExpExecArray | undefined => {
    const all = [...text.matchAll(pattern)]
    return all.length === 0 ? undefined : pick(all)
  }
  const replace = (match: RegExpExecArray | undefined, by: (found: string) => string): string => (match === undefined ? text : text.slice(0, match.index) + by(match[0]) + text.slice(match.index + match[0].length))
  switch (Math.floor(next() * 3)) {
    case 0:
      return replace(at(/(?<=[\s,"(MLHVCSQTAZmlhvcsqtaz-])-?\d*\.?\d+(?:e-?\d+)?/gi), () => pick(EDGES))
    case 1:
      return replace(at(/<(?:rect|path|circle|ellipse|line|polyline|polygon|g|stop|linearGradient|radialGradient)\b/g), (found) => `${found} ${pick(SETTINGS)}`)
    default:
      return replace(at(/<(?:rect|circle|ellipse|path|line)\b[^>]*\/>/g), (found) => found.repeat(2))
  }
}

/** `count` drawings, each a seeded run of one to three mutations of one of `DRAWINGS`. */
export function mutations(count: number, seed: number): string[] {
  const next = random(seed)
  const bases = Object.values(DRAWINGS)
  return Array.from({ length: count }, (_, index) => {
    let text = bases[index % bases.length]!
    for (let step = 1 + Math.floor(next() * 3); step > 0; step -= 1) text = mutate(text, next)
    return text
  })
}

/** The box, in points from the page's top left, of every pixel that is not white, or nothing on a page of white. */
export function inkBox(pixels: PagePixels, scale: number): { readonly x: number; readonly top: number; readonly right: number; readonly bottom: number } | undefined {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const at = (y * pixels.width + x) * 4
      if (pixels.data[at]! > 250 && pixels.data[at + 1]! > 250 && pixels.data[at + 2]! > 250) continue
      ;[left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x + 1), Math.max(bottom, y + 1)]
    }
  }
  return left === Infinity ? undefined : { x: left / scale, top: top / scale, right: right / scale, bottom: bottom / scale }
}

/** The colour of the pixel at a point, in points from the page's top left, as `#rrggbb`. */
export function colourAt(pixels: PagePixels, scale: number, x: number, y: number): string {
  const at = (Math.floor(y * scale) * pixels.width + Math.floor(x * scale)) * 4
  return `#${[0, 1, 2].map((channel) => pixels.data[at + channel]!.toString(16).padStart(2, '0')).join('')}`
}
