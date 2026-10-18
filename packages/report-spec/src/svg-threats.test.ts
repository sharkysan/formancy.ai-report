import { describe, expect, test } from 'vitest'
import { MAX_SVG_BYTES } from './limits.js'
import { cleanSvg } from './svg.js'
import { SVG_ADVICE, SVG_REFUSAL_CODES, type SvgRefusalCode } from './svg-refusal.js'
import { ascii, CEILING_MS, cleaned, refused, svg, utf8 } from './svg-test-support.js'

const RECT = '<rect width="1" height="1"/>'
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"'

/**
 * The hazards 0030 found, each a file a host might be handed: what svg-to-pdfkit
 * would do with it as it came, and what the cleaner does instead. Each
 * refusal carries its code, and its message holds none of the value that
 * made the file dangerous -- a path, an address, a script, a style, a word
 * -- so that nothing a file held is repeated to a log or a person.
 */
const THREATS: ReadonlyArray<{ readonly name: string; readonly svg: string; readonly code: string; readonly secrets: readonly string[] }> = [
  // The converter opens an <image>'s file past pdfmake's local access policy.
  { name: 'a local image', svg: svg('<image href="C:/Windows/win.ini" width="1" height="1"/>'), code: 'raster', secrets: ['Windows', 'win.ini'] },
  { name: 'a local image by xlink:href', svg: svg(`<image ${XLINK} xlink:href="/etc/passwd" width="1" height="1"/>`), code: 'raster', secrets: ['etc', 'passwd'] },
  // ... and embeds a data: image with none of the asset checks.
  { name: 'an embedded image', svg: svg('<image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>'), code: 'raster', secrets: ['base64', 'iVBOR'] },
  // ... draws text in a font pdfmake picks, past the glyph check.
  { name: 'text in CJK', svg: svg('<text x="1" y="1">AB山田</text>'), code: 'text', secrets: ['AB', '山田'] },
  // ... parses <style> as CSS, an import included.
  { name: 'an imported stylesheet', svg: svg(`<style>@import url(https://example.invalid/steal.css);</style>${RECT}`), code: 'unsupported', secrets: ['example', 'steal'] },
  { name: 'an external stylesheet', svg: `<?xml-stylesheet type="text/css" href="https://example.invalid/steal.css"?>${svg(RECT)}`, code: 'unsupported', secrets: ['example', 'steal', 'text/css'] },
  // Entities: the billion laughs and the external entity.
  {
    name: 'a DOCTYPE declaring entities',
    svg: `<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]>${svg('<rect width="1" height="1" fill="&secret;"/>')}`,
    code: 'doctype',
    secrets: ['secret', 'passwd', 'file:'],
  },
  { name: 'an undeclared entity', svg: svg('<rect width="1" height="1" fill="&ext;"/>'), code: 'doctype', secrets: ['ext;'] },
  // The converter follows a gradient cycle until the stack overflows.
  { name: 'a gradient cycle', svg: svg('<linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/><rect width="1" height="1" fill="url(#a)"/>'), code: 'reference', secrets: ['#a', '#b'] },
  // A use fan-out of a kilobyte drew 10^5 rects in 4.8 s and 10^6 killed the process.
  {
    name: 'a use fan-out',
    svg: svg(`<defs><rect id="r0" width="1" height="1"/>${Array.from({ length: 6 }, (_, i) => `<g id="r${i + 1}">${`<use href="#r${i}"/>`.repeat(10)}</g>`).join('')}</defs><use href="#r6"/>`),
    code: 'reference',
    secrets: ['#r'],
  },
  // PDFKit throws `unsupported number: 1e+30`, naming no asset.
  { name: 'a number PDFKit throws at', svg: svg('<rect width="1e30" height="1"/>'), code: 'out-of-range', secrets: ['1e30', '1e+30'] },
  // References to anything outside the file would need documentCallback.
  { name: 'a paint from an address', svg: svg('<rect width="1" height="1" fill="url(https://example.invalid/a.svg#g)"/>'), code: 'reference', secrets: ['example', 'a.svg'] },
  { name: 'a paint from an address in CSS', svg: svg('<style>rect{fill:url(https://example.invalid/a.svg#g)}</style><rect width="1" height="1"/>'), code: 'reference', secrets: ['example', 'a.svg'] },
  { name: 'a gradient from another file', svg: svg('<linearGradient id="a" href="https://example.invalid/a.svg#g"/><rect width="1" height="1" fill="url(#a)"/>'), code: 'reference', secrets: ['example', 'a.svg'] },
  // Illustrator's editing data, and HTML a browser would draw and the converter would not.
  { name: 'a foreign object', svg: svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">secret</div></foreignObject>'), code: 'unsupported', secrets: ['secret', 'div'] },
  // Recursion: 5,000 levels overflowed the converter's stack; the reader is iterative, the bound refuses first.
  { name: 'five thousand levels', svg: svg(`${'<g>'.repeat(5000)}${RECT}${'</g>'.repeat(5000)}`), code: 'too-deep', secrets: [] },
]

describe('the hazards of an SVG as it comes', () => {
  test.each(THREATS)('$name is refused as $code, its value unsaid', ({ svg: text, code, secrets }) => {
    const refusal = refused(text)
    expect(refusal.code).toBe(code)
    for (const secret of secrets) expect(refusal.message).not.toContain(secret)
  })

  // A link annotation with any URI, javascript: included, is what the
  // converter writes for an <a> whatever the callbacks say;
  // a script, an event handler and a metadata block are removed, and none
  // of their text is written or listed.
  test('a link, a script, a handler and metadata are removed, none of their text written or listed', () => {
    const result = cleaned(
      svg(`<metadata>secret-metadata</metadata><script>alert('secret-script')</script><a href="javascript:app.alert('secret-link')"><rect width="1" height="1" onclick="alert('secret-handler')"/></a>`),
    )
    expect(result.text).not.toMatch(/secret|alert|javascript|href|onclick/)
    expect(JSON.stringify(result.removed)).not.toMatch(/secret|alert|javascript/)
  })

  // An SVG of a megabyte of what is removed costs the reader a pass and no
  // more, and is never recursed into: nesting inside what is removed is
  // read past, unbounded and iteratively.
  test('deep nesting inside what is removed is read past', () => {
    const deep = `<metadata>${'<x:a xmlns:x="urn:x">'.repeat(20_000)}${'</x:a>'.repeat(20_000)}</metadata>`
    expect(cleaned(svg(`${deep}${RECT}`)).text).toBe(svg(RECT))
  })

  // A refusal is returned, never thrown: a host's approval code gets a
  // code and a message for anything it hands over, whatever it is.
  test('a refusal is returned for anything, never thrown', () => {
    for (const bytes of [new Uint8Array(0), utf8('<'), utf8('<svg'), utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"'), Uint8Array.from([0xff, 0x00, 0x3c]), utf8(`${svg(RECT)}<!--`)]) {
      const result = cleanSvg(bytes)
      expect(result.ok, ascii(bytes)).toBe(false)
    }
    expect(cleanSvg('not bytes' as unknown as Uint8Array)).toEqual({ ok: false, code: 'not-svg', message: 'the asset has no bytes; hand it the bytes of the file' })
  })
})

/**
 * A file of `MAX_SVG_BYTES` that opens with `open`, repeats `unit` and ends
 * with `close`: as much of one shape as a file may hold.
 */
function mebibyteOf(open: string, unit: string, close: string): string {
  return `${open}${unit.repeat(Math.floor((MAX_SVG_BYTES - open.length - close.length) / unit.length))}${close}`
}

const OPEN = svg('').slice(0, -'</svg>'.length)

/**
 * Each shape of a value a regular expression, or a search that starts
 * again where the last one started, could take time for that grows with
 * the square of its length: what review found, an rgb() of percentages
 * whose digits a pattern could split every way, a number's trailing zeros,
 * and what the cleaner's every other pattern and search is held to with
 * them.
 */
const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ['the digits of an rgb() percentage', mebibyteOf(`${OPEN}<rect width="1" height="1" fill="rgb(`, '1', ')"/></svg>')],
  ["a number's trailing zeros", mebibyteOf(`${OPEN}<rect width="1" height="1" x="0.`, '0', '1"/></svg>')],
  ["a number's digits", mebibyteOf(`${OPEN}<path d="M0 0 L0.`, '1', ' 1"/></svg>')],
  ["the spaces of a url() that holds no address", mebibyteOf(`${OPEN}<rect width="1" height="1" fill="url(`, ' ', 'x"/></svg>')],
  ['an id that is not closed', mebibyteOf(`${OPEN}<rect width="1" height="1" fill="url(#`, 'a', '"/></svg>')],
  ['a dash array', mebibyteOf(`${OPEN}<rect width="1" height="1" stroke="red" stroke-dasharray="`, '1 ', '"/></svg>')],
  ['a transform list', mebibyteOf(`${OPEN}<rect width="1" height="1" transform="`, 'scale(1)', '"/></svg>')],
  ["a transform's arguments, not closed", mebibyteOf(`${OPEN}<rect width="1" height="1" transform="scale(`, '1 ', '"/></svg>')],
  ['a class list', mebibyteOf(`${OPEN}<style>.a{fill:red}</style><rect width="1" height="1" class="`, 'a ', '"/></svg>')],
  ["a style's empty declarations", mebibyteOf(`${OPEN}<rect width="1" height="1" style="`, ';', 'fill:red"/></svg>')],
  ["a style's spaces", mebibyteOf(`${OPEN}<rect width="1" height="1" style="fill:`, ' ', 'red"/></svg>')],
  ["path data's spaces", mebibyteOf(`${OPEN}<path d="M0 0`, ' ', 'L1 1"/></svg>')],
  ["an XML declaration's spaces", mebibyteOf('<?xml version="1.0"', ' ', `x?>${svg(RECT)}`)],
  ['a selector', mebibyteOf(`${OPEN}<style>`, 'a', '{fill:red}</style><rect width="1" height="1"/></svg>')],
  ['a compound selector', mebibyteOf(`${OPEN}<style>`, '.a', '!{fill:red}</style><rect width="1" height="1"/></svg>')],
  ["a comment's dashes", mebibyteOf(`${OPEN}<!--`, '-a', '--><rect width="1" height="1"/></svg>')],
  ["a CDATA section's brackets", mebibyteOf(`${OPEN}<style><![CDATA[`, ']', ']]></style><rect width="1" height="1"/></svg>')],
  ["text's brackets", mebibyteOf(`${OPEN}<g>`, ']]', '</g></svg>')],
  ['references', mebibyteOf(`${OPEN}<rect width="1" height="1" data-x="`, '&#38;', '"/></svg>')],
]

describe('a mebibyte of one shape', () => {
  // Each bound holds what a file may cost only if reading up to it takes
  // time linear in the bytes: one pattern that tries every split of a run
  // of digits took the renderer's check minutes on one colour of a
  // mebibyte, the server's event loop or the Studio's page with it. Each
  // shape, as much of it as a file may hold, is cleaned -- accepted or
  // refused -- in well under what a reader quadratic in it takes
  // (`CEILING_MS`).
  test.each(SHAPES)('of %s is cleaned in linear time', (_, text) => {
    expect(text.length).toBeGreaterThan(MAX_SVG_BYTES - 16)
    const bytes = utf8(text)
    const started = Date.now()
    cleanSvg(bytes)
    expect(Date.now() - started).toBeLessThan(CEILING_MS)
  })
})

/** A file refused with each code, by a refusal that knows nothing more particular to say than its code's advice. */
const BY_CODE: { readonly [C in SvgRefusalCode]: string } = {
  'not-svg': '<html/>',
  'not-well-formed': svg(`<g>${RECT}`),
  encoding: svg(`<style>.ü{fill:red}</style>${RECT}`),
  doctype: svg('<rect width="1" height="1" fill="&ext;"/>'),
  text: svg(`<g>logo</g>${RECT}`),
  raster: svg('<image href="a.png" width="1" height="1"/>'),
  reference: svg('<rect width="1" height="1" href="#a"/>'),
  unsupported: svg('<feGaussianBlur/>'),
  'out-of-range': svg('<rect width="1e9" height="1"/>'),
  'too-large': svg(RECT.repeat(10_000)),
  'too-deep': svg(`${'<g>'.repeat(40)}${RECT}${'</g>'.repeat(40)}`),
}

describe('what to do', () => {
  // A refusal is what a person who uploaded a logo is shown, and a code
  // alone sends them back to the drawing program with nothing to try:
  // every refusal says what to do after what it found (0030), its own
  // advice or its code's.
  test.each(SVG_REFUSAL_CODES)('a refusal as %s says what to do', (code) => {
    const refusal = refused(BY_CODE[code])
    expect(refusal.code).toBe(code)
    expect(refusal.message.endsWith(`; ${SVG_ADVICE[code]}`), refusal.message).toBe(true)
  })
})
