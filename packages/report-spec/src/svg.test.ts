import { describe, expect, test } from 'vitest'
import { CHILDREN, GEOMETRY, GRADIENTS, isKept, type KeptElement, TRANSFORMED, WRITTEN_ON, type WrittenProperty } from './svg-allow.js'
import { EXPORTER_SAMPLES } from './svg-exporters.js'
import { checkSvg, cleanSvg } from './svg.js'
import type { Drawing } from './svg-drawing.js'
import { attribute, writeDrawing } from './svg-write.js'
import { ascii, cleaned, mutations, type ReadElement, readBack, refused, svg, utf8 } from './svg-test-support.js'

const SVG = 'http://www.w3.org/2000/svg'
const URL = /url\(#([^)]*)\)/

/**
 * Every name in a cleaned drawing, read back by saxes, checked against the
 * tables in `svg-allow.ts`: each element kept and in a parent that may hold
 * it, each attribute that element's geometry, its transform, a property
 * written on that element (`WRITTEN_ON`) or a gradient's or clip path's id,
 * nothing prefixed, no node but elements, and no value that could be read
 * as markup. And every reference resolved: each `url(#…)` names an id the
 * drawing writes, a gradient's for a fill or a stroke and a clip path's for
 * a clip-path, and every id is named by one, since the cleaner writes no
 * other.
 */
function onlyAllowedNames(text: string): void {
  const { root, others } = readBack(text)
  expect(others, 'nodes other than elements').toEqual([])
  expect([root.name, root.uri, root.prefix]).toEqual(['svg', SVG, ''])
  expect(root.attributes.map(({ name }) => name).sort()).toEqual(['viewBox', 'xmlns'])
  const ids = new Map<string, KeptElement>()
  const references: Array<{ readonly id: string; readonly property: string; readonly at: string }> = []
  const visit = (element: ReadElement, parent: KeptElement | undefined): void => {
    expect([element.uri, element.prefix], element.name).toEqual([SVG, ''])
    expect(isKept(element.name), element.name).toBe(true)
    const name = element.name as KeptElement
    if (parent !== undefined) expect(CHILDREN[parent].has(name), `${name} in ${parent}`).toBe(true)
    for (const attribute of element.attributes) {
      if (name === 'svg') continue
      const at = `${name}@${attribute.name}`
      expect(attribute.prefix, attribute.name).toBe('')
      const allowed =
        GEOMETRY[name].includes(attribute.name) ||
        (attribute.name === 'transform' && TRANSFORMED.has(name)) ||
        WRITTEN_ON[name].has(attribute.name as WrittenProperty) ||
        (attribute.name === 'id' && (GRADIENTS.has(name) || name === 'clipPath'))
      expect(allowed, at).toBe(true)
      expect(attribute.value, at).not.toMatch(/[<>&"'\u0080-￿]/)
      if (attribute.name === 'id') {
        expect(ids.has(attribute.value), `${at} written twice`).toBe(false)
        ids.set(attribute.value, name)
      }
      const reference = URL.exec(attribute.value)
      if (reference !== null) references.push({ id: reference[1] ?? '', property: attribute.name, at })
    }
    for (const child of element.children) visit(child, name)
  }
  visit(root, undefined)
  for (const { id, property, at } of references) {
    const target = ids.get(id)
    expect(target, `${at} names ${id}, which the drawing does not write`).toBeDefined()
    expect(property === 'clip-path' ? target === 'clipPath' : GRADIENTS.has(target as KeptElement), `${at} names a ${target}`).toBe(true)
  }
  expect(
    [...ids.keys()].filter((id) => !references.some((reference) => reference.id === id)),
    'ids nothing names',
  ).toEqual([])
}

/** Cleaning `bytes` again gives the same bytes with nothing removed, and `checkSvg` accepts them. */
function fixedPoint(bytes: Uint8Array): void {
  const again = cleanSvg(bytes)
  expect(again.ok && ascii(again.bytes), 'cleaned again').toBe(ascii(bytes))
  expect(again.ok && again.removed, 'removed cleaning again').toEqual([])
  expect(checkSvg(bytes).ok, 'checked').toBe(true)
}

/** Every byte under 0x80. */
function isAscii(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte < 0x80)
}

const ACCEPTED = ['illustrator-save-as', 'illustrator-export-as', 'inkscape-1', 'figma', 'figma-fade', 'affinity', 'sketch', 'canva']
const REFUSED: { readonly [name: string]: string } = {
  'illustrator-save-as-text': 'text',
  'illustrator-save-as-editing': 'doctype',
  'illustrator-cs-entities': 'doctype',
  'sketch-text': 'text',
  'canva-text': 'reference',
}

describe("the exporters' samples", () => {
  // A logo is drawn in one of a few programs, each writing SVG its own way;
  // the grammar was amended (0030) so that each program's plain
  // export of a drawing is accepted. If one of these is refused, a logo
  // from that program is, and its person is told to fix a file that is
  // fine.
  test.each(ACCEPTED)('%s is accepted, cleaned to a fixed point and holds only allowed names', (name) => {
    const sample = EXPORTER_SAMPLES[name]?.svg ?? ''
    const result = cleaned(sample)
    expect(isAscii(result.bytes)).toBe(true)
    onlyAllowedNames(result.text)
    fixedPoint(result.bytes)
  })

  // What 0030 says a logo from these programs meets in an e-invoice
  // (report-render-pdf's `svg-pdfa.ts`): each draws its clips and its
  // transparency under no matrix that shrinks them -- the inverse's rows
  // sum to 1 at most, and take the viewBox's origin nowhere -- and nests
  // five graphics states deep at most, so the renderer refuses none of
  // them for its nesting, nor for its groups but as the image's own box
  // shrinks. A sample that shrank its clip would fail here, not at an
  // e-invoice's render.
  test.each(ACCEPTED)('%s makes its page-sized groups under no shrink and nests five deep at most', (name) => {
    const { extent } = cleaned(EXPORTER_SAMPLES[name]?.svg ?? '')
    expect(extent.groups.inverse).toBeLessThanOrEqual(1)
    expect(extent.groups.origin).toBe(0)
    expect(extent.nesting).toBeLessThanOrEqual(5)
  })

  // What 0030's costs say a person meets: live text, Illustrator's editing
  // data and Canva's lettering are refused, each with what to do.
  test.each(Object.entries(REFUSED))('%s is refused as %s', (name, code) => {
    expect(refused(EXPORTER_SAMPLES[name]?.svg ?? '').code).toBe(code)
  })

  // Every sample is one of the two lists, so a sample added without a
  // verdict fails here rather than passing unread; and 0030, the CHANGELOG
  // and the release's limitations say how many are each.
  test('every sample has a verdict', () => {
    expect(Object.keys(EXPORTER_SAMPLES).sort()).toEqual([...ACCEPTED, ...Object.keys(REFUSED)].sort())
    expect([Object.keys(EXPORTER_SAMPLES).length, ACCEPTED.length, Object.keys(REFUSED).length]).toEqual([13, 8, 5])
  })

  // The writer builds from its own tree, never copying a span: a sample's
  // editor data, its comments and its layer names, some with umlauts, are
  // not in what it writes, and are reported as removed.
  test("Inkscape's editor data is removed and reported, its umlauts with it", () => {
    const result = cleaned(EXPORTER_SAMPLES['inkscape-1']?.svg ?? '')
    expect(result.text).not.toMatch(/inkscape|sodipodi|Ebene|label/)
    const removed = result.removed.map(({ kind, name, count }) => `${kind} ${name}${count > 1 ? ` x${count}` : ''}`)
    expect(removed).toEqual(
      expect.arrayContaining([
        'element sodipodi:namedview',
        'attribute inkscape:label',
        'attribute inkscape:collect x2',
        'property -inkscape-stroke',
        'property font-variation-settings x2',
        'property marker',
        'comment comment',
        'element linearGradient',
      ]),
    )
    expect(result.removedMore).toBe(0)
  })
})

describe('the fixed point', () => {
  // checkSvg accepts at print only what cleanSvg wrote; if cleaning its own
  // output changed a byte, every approved logo would be refused at every
  // print, and if it removed something, checkSvg would accept a drawing
  // cleaning changes. A thousand seeded mutations of the samples reach
  // number forms, relative commands, colours, transforms, styles and
  // broken bytes the samples alone never do.
  test('holds for a thousand seeded mutations, each read back by saxes', () => {
    const bases = ACCEPTED.map((name) => EXPORTER_SAMPLES[name]?.svg ?? '')
    let accepted = 0
    for (const text of mutations(bases, 1000, 0x5eed)) {
      const result = cleanSvg(utf8(text))
      if (!result.ok) continue
      accepted += 1
      expect(isAscii(result.bytes), text).toBe(true)
      onlyAllowedNames(ascii(result.bytes))
      fixedPoint(result.bytes)
    }
    // A stream that refused nearly everything would test nothing. It
    // mutates gradients, stops, clip paths and defs too, where more of what
    // it adds is refused: 297 of the thousand were accepted on 18 October
    // 2026.
    expect(accepted).toBeGreaterThan(250)
  })

  // A paint or a clip on a gradient or one of its stops never draws, and
  // nothing follows a reference made there: written as it was, it named no
  // target, `url(#)`, which cleaning refused the second time, so an
  // approved drawing would have been refused at every print. The
  // renderer's converter check found it in a mutation.
  // Everything but a stop's colour and opacity is removed from both, and
  // listed.
  test('holds for a paint or a clip on a gradient or a stop, which never draws', () => {
    const result = cleaned(
      svg(
        '<linearGradient id="a" clip-path="url(#nowhere)" fill="red" opacity="0.5"><stop offset="0" stop-color="#000" clip-path="url(#nowhere)" fill="url(#a)" stroke-width="3"/><stop offset="1" stop-color="#fff" stop-opacity="0.5"/></linearGradient><rect width="1" height="1" fill="url(#a)"/>',
      ),
    )
    expect(result.text).toBe(
      svg(
        '<linearGradient id="g1"><stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.5"/></linearGradient><rect width="1" height="1" fill="url(#g1)"/>',
      ),
    )
    expect(result.removed).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'property', name: 'clip-path' }), expect.objectContaining({ kind: 'property', name: 'fill' })]),
    )
    fixedPoint(result.bytes)
  })
})

describe('the writer', () => {
  // Every value is generated, so none can hold markup; were a bug to hand
  // the writer one, it throws rather than escape it or write it, and the
  // error is not mistaken for a refusal of the customer's file.
  test('refuses to write markup into a value, and that error is not a refusal', () => {
    expect(() => attribute('fill', '"/><script')).toThrow('a value is always generated, so this is a bug in the cleaner')
    class Broken extends Uint8Array {
      override subarray(): Uint8Array<ArrayBuffer> {
        throw new Error('a bug')
      }
    }
    expect(() => cleanSvg(Broken.from(utf8(svg('<rect width="1" height="1" fill="&#35;abc"/>'))))).toThrow('a bug')
  })

  // A reference the writer can name no target for would be written
  // `url(#)`, which cleaning refused the second time: an asset approved,
  // then refused at every print (the converter check found one). It throws
  // instead, as a bug in the cleaner, and never writes it.
  test('refuses to write a reference to nothing it writes', () => {
    const rect = {
      name: 'rect',
      geometry: [],
      transform: undefined,
      properties: [['fill', { reference: { id: 'gone', where: 'svg/rect@fill' }, fallback: undefined }]],
      children: [],
      id: undefined,
    }
    const root = { name: 'svg', geometry: [['viewBox', '0 0 1 1']], transform: undefined, properties: [], children: [rect], id: undefined }
    expect(() => writeDrawing({ root, viewBox: { x: 0, y: 0, width: 1, height: 1 }, targets: new Map() } as unknown as Drawing)).toThrow(
      'at svg/rect@fill; every reference kept names a target, so this is a bug in the cleaner',
    )
  })
})

describe('checkSvg', () => {
  // The renderer's check refuses what cleaning would change, naming what,
  // so a host that never ran cleanSvg is told to; it never cleans at print,
  // which would print something other than what was approved.
  test('refuses what cleaning would remove, naming it', () => {
    const raw = svg('<!-- x --><rect width="1" height="1"/>')
    expect(checkSvg(utf8(raw))).toEqual({
      ok: false,
      code: 'unsupported',
      message: 'the drawing holds a comment, which cleaning removes; clean it with cleanSvg first',
    })
    expect(checkSvg(utf8(svg('<rect width="1" height="1" data-x="y"/>')))).toMatchObject({ message: expect.stringContaining('the attribute data-x') })
  })

  // Valid bytes in another form than cleanSvg's -- a space, a short
  // colour -- are refused naming the byte where the forms part.
  test('refuses another form of the same drawing, naming where it differs', () => {
    const clean = cleaned(svg('<rect width="1" height="1" fill="#abc"/>')).text
    expect(checkSvg(utf8(clean.replace('#aabbcc', '#abc')))).toEqual({
      ok: false,
      code: 'unsupported',
      message: `the drawing is not in the form cleanSvg writes, from byte ${clean.indexOf('#aabbcc') + 2}; clean it with cleanSvg first`,
    })
    expect(checkSvg(utf8(`${clean} `)).ok).toBe(false)
  })

  // What checkSvg accepts is the drawing, without a removal list that
  // would always be empty.
  test('returns the drawing and its costs for clean bytes', () => {
    const result = checkSvg(cleaned(svg('<rect width="1" height="1"/>')).bytes)
    expect(result).toMatchObject({
      ok: true,
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      segments: 5,
      groups: 0,
      drawn: { lines: 5, curves: 0, elements: 2 },
    })
    expect(result).not.toHaveProperty('removed')
  })

  // A refusal passes through checkSvg as cleanSvg gave it.
  test('passes a refusal through', () => {
    expect(checkSvg(utf8('<html/>'))).toMatchObject({ ok: false, code: 'not-svg' })
  })
})
