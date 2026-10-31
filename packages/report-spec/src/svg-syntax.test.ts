import { describe, expect, test } from 'vitest'
import { SVG_ADVICE } from './svg-refusal.js'
import { cleaned, refused, svg, utf8 } from './svg-test-support.js'

const RECT = '<rect width="1" height="1"/>'

describe('the bytes of an SVG', () => {
  // A UTF-8 byte order mark is how Windows' editors save; refusing it
  // would refuse a plain file.
  test('a UTF-8 byte order mark is read past', () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8(svg(RECT))])
    expect(cleaned(bytes).text).toBe(cleaned(svg(RECT)).text)
  })

  // A UTF-16 or UTF-32 file has bytes every reader of this ASCII-only
  // format would read as other characters, so it is refused by its byte
  // order mark, or by the zero bytes when it has none.
  test.each([
    ['UTF-16 big-endian', [0xfe, 0xff]],
    ['UTF-16 little-endian', [0xff, 0xfe]],
    ['UTF-32 big-endian', [0, 0, 0xfe, 0xff]],
    ['UTF-16 without a mark', [0x3c, 0, 0x73, 0]],
  ])('%s is refused as encoding', (_, prefix) => {
    expect(refused(Uint8Array.from([...prefix, ...utf8(svg(RECT))])).code).toBe('encoding')
  })

  // A byte past ASCII must mean one thing to every reader, and the one way
  // to be sure is to keep none: in what is removed it is read past, in
  // what is kept it is refused.
  test('a byte past ASCII is read past in a comment and a title and refused in a fill', () => {
    expect(cleaned(svg(`<!-- Größe --><title>Entwürfe</title>${RECT}`)).text).toBe(cleaned(svg(RECT)).text)
    expect(refused(svg('<rect width="1" height="1" fill="grün"/>'))).toEqual({
      ok: false,
      code: 'encoding',
      message: 'svg/rect@fill holds a byte past ASCII; write it in ASCII',
    })
    // A reference that names a character past ASCII is the same thing.
    expect(refused(svg('<rect width="1" height="1" fill="gr&#252;n"/>')).code).toBe('encoding')
  })

  // The encodings whose ASCII bytes are ASCII are read; another one could
  // make a reader decode the kept bytes as other characters.
  test.each(['UTF-8', 'utf-8', 'US-ASCII', 'ISO-8859-1'])('the declared encoding %s is read', (encoding) => {
    expect(cleaned(`<?xml version="1.0" encoding="${encoding}"?>${svg(RECT)}`).removed).toContainEqual({ kind: 'declaration', name: 'declaration', count: 1 })
  })

  test.each(['UTF-16', 'windows-1252', 'Shift_JIS'])('the declared encoding %s is refused', (encoding) => {
    expect(refused(`<?xml version="1.0" encoding="${encoding}"?>${svg(RECT)}`).code).toBe('encoding')
  })

  // XML 1.1 reads characters and line ends otherwise than 1.0 does.
  test('an XML version other than 1.0 is refused', () => {
    expect(refused(`<?xml version="1.1"?>${svg(RECT)}`)).toEqual({
      ok: false,
      code: 'unsupported',
      message: 'the file is XML 1.1, which this format does not read; save it as XML 1.0',
    })
  })

  // A control character is not a character XML 1.0 allows, and readers
  // differ on what they do with one.
  test('a control character is refused as not well-formed', () => {
    expect(refused(svg(`<rect width="1"\u0001 height="1"/>`))).toMatchObject({
      code: 'not-well-formed',
      message: expect.stringContaining('a control character XML forbids'),
    })
  })
})

describe('the markup of an SVG', () => {
  // What is not well-formed (0030): each one a file two
  // parsers could read as two trees.
  test.each([
    ['an unclosed element', svg(`<g>${RECT}`).replace('</svg>', ''), 'svg/g is not closed'],
    ['a mismatched end tag', svg('<g></defs>'), 'does not match'],
    ['an attribute given twice', svg('<rect width="1" width="2"/>'), 'an attribute given twice'],
    [
      'the same attribute under two prefixes',
      svg('<linearGradient xmlns:a="http://www.w3.org/1999/xlink" xmlns:b="http://www.w3.org/1999/xlink" a:href="#x" b:href="#x"/>'),
      'twice under two prefixes',
    ],
    ['an unquoted value', svg('<rect width=1/>'), 'without quotes'],
    ['< in a value', svg('<rect width="<"/>'), '< in an attribute value'],
    ['& alone in a value', svg('<rect width="1 & 2"/>'), '& that does not start a reference'],
    ['a second root', `${svg(RECT)}${svg(RECT)}`, 'a second element after the root'],
    ['text after the root', `${svg(RECT)}x`, 'character data outside the root'],
    ['attributes with no space between', svg('<rect width="1"height="1"/>'), 'not separated by a space'],
    ['a comment holding --', svg(`<!-- a -- b -->${RECT}`), 'holds --'],
    [']]> in text', svg(`]]>${RECT}`), ']]> in character data'],
    ['a misplaced colon', svg('<:rect/>'), 'misplaced colon'],
    ['an undeclared prefix', svg('<x:rect/>'), 'no namespace is declared'],
    ['an undeclared attribute prefix', svg('<rect x:a="1"/>'), 'no namespace is declared'],
    ['an emptied prefix', svg('<g xmlns:x=""/>'), 'a namespace declaration XML forbids'],
    ['a reference to a character XML forbids', svg('<rect width="&#0;"/>'), 'a character XML forbids'],
    ['a reference to a surrogate', svg('<rect width="&#xD800;"/>'), 'a character XML forbids'],
    ['a declaration after the start', `<!-- x --><?xml version="1.0"?>${svg(RECT)}`, 'XML declaration anywhere but at the very start'],
    ['a declaration outside a DOCTYPE', svg(`<!ENTITY x "y">${RECT}`), 'a declaration outside a DOCTYPE'],
    ['an unclosed comment', `${svg(RECT)}<!--`, 'not closed'],
    ['an unclosed DOCTYPE', `<!DOCTYPE svg "a>"`, 'a DOCTYPE that is not closed'],
  ])('%s is refused as not well-formed', (_, text, said) => {
    const refusal = refused(text)
    expect(refusal.code).toBe('not-well-formed')
    expect(refusal.message).toContain(said)
  })

  // Comments and the declaration are removed and listed, a DOCTYPE with no
  // internal subset too: none draws, and none is in what is written.
  test('a comment, the declaration and a plain DOCTYPE are removed and listed', () => {
    const result = cleaned(
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><!-- a -->${svg(`<!-- b -->${RECT}`)}<!-- c -->`,
    )
    expect(result.removed).toEqual([
      { kind: 'declaration', name: 'declaration', count: 1 },
      { kind: 'doctype', name: 'doctype', count: 1 },
      { kind: 'comment', name: 'comment', count: 3 },
    ])
    expect(result.text).toBe(cleaned(svg(RECT)).text)
  })

  // The billion laughs and the external entity start in an internal
  // subset; no entity is ever declared or expanded, so a DOCTYPE with one
  // is refused, and so is a reference to an entity XML does not predefine
  // (0030).
  test('an internal subset and a reference to an undeclared entity are refused as doctype', () => {
    const laughs = `<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]>${svg(`<rect width="1" height="1" fill="&b;"/>`)}`
    expect(refused(laughs).code).toBe('doctype')
    expect(refused(svg('<rect width="1" height="1" fill="&ext;"/>'))).toMatchObject({
      code: 'doctype',
      message: expect.stringContaining('an entity XML does not predefine'),
    })
    // A quoted [ is a literal, not a subset.
    expect(cleaned(`<!DOCTYPE svg SYSTEM "a[b">${svg(RECT)}`).text).toBe(cleaned(svg(RECT)).text)
  })

  // XML's five entities and numeric references are read in a kept value,
  // so a file that writes `&#35;` for `#` draws as one that writes `#`.
  test('the five predefined entities and numeric references are read', () => {
    expect(cleaned(svg('<rect width="1" height="1" fill="&#35;abc"/>')).text).toContain('fill="#aabbcc"')
    expect(cleaned(svg('<rect width="1" height="1" fill="&#x23;abc"/>')).text).toContain('fill="#aabbcc"')
    expect(cleaned(svg('<rect width="1" height="1" data-x="&lt;&gt;&amp;&quot;&apos;"/>')).text).toBe(cleaned(svg(RECT)).text)
  })

  // A processing instruction other than the declaration is refused -- an
  // xml-stylesheet is an external stylesheet -- unless it sits in what is
  // removed, as Illustrator's XMP packet does in its metadata (0030).
  test('a processing instruction is refused, and read past inside what is removed', () => {
    expect(refused(`<?xml-stylesheet href="http://example.invalid/a.css"?>${svg(RECT)}`)).toEqual({
      ok: false,
      code: 'unsupported',
      message: 'the document holds a processing instruction (xml-stylesheet), which this format does not read; save it as plain SVG',
    })
    expect(cleaned(svg(`<metadata><?xpacket begin="" id="W5M0"?><x:xmpmeta xmlns:x="adobe:ns:meta/"/></metadata>${RECT}`)).text).toBe(cleaned(svg(RECT)).text)
    expect(cleaned(svg(`<script><![CDATA[ if (a < b) alert(1) ]]></script>${RECT}`)).removed).toContainEqual({ kind: 'element', name: 'script', count: 1 })
  })

  // Text a drawing holds outside a text element is a run nobody sees, and
  // CDATA outside a style is that or code.
  test('text and CDATA outside a style are refused', () => {
    expect(refused(svg(`<g>logo${RECT}</g>`))).toEqual({ ok: false, code: 'text', message: 'svg/g holds text; convert the text to outlines' })
    expect(refused(svg(`<g><![CDATA[ x ]]>${RECT}</g>`)).code).toBe('unsupported')
    expect(cleaned(svg(`<g>\n\t ${RECT}\n</g>`)).text).toBe(cleaned(svg(RECT)).text)
  })

  // A message names the element path, with an index from the second of a
  // name on, and the byte offset for what is not well-formed.
  test('messages name the element path and the byte', () => {
    expect(refused(svg('<g/><g><rect/><rect/><text/></g>')).message).toBe('svg/g[2]/text is text; convert the text to outlines')
    const twice = svg('<g><rect width="1" width="1"/></g>')
    expect(refused(twice).message).toBe(`at byte ${twice.lastIndexOf('width')} in svg/g: an attribute given twice; ${SVG_ADVICE['not-well-formed']}`)
  })

  // An element path is built of names as a message may repeat them: an
  // element this format does not know may be named anything, and its name
  // in the path, past ASCII or a kilobyte long, would repeat the file's own
  // bytes to a log and grow with what the file holds (svg-refusal.ts).
  test('an element path never repeats a name the message would not', () => {
    for (const name of ['y'.repeat(1000), 'grün'])
      expect(refused(svg(`<g><${name}/></g>`)).message).toBe(`svg/g/element is an element, which this format does not draw; ${SVG_ADVICE.unsupported}`)
  })
})

describe('the namespaces of an SVG', () => {
  // An element is SVG's by its namespace, not its prefix, so an svg:rect
  // draws, and an editor's element in its own namespace is removed with
  // everything inside it.
  test('an svg: prefix is read, and another namespace is removed with its subtree', () => {
    const prefixed = cleaned(`<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><s:rect width="1" height="1"/></s:svg>`)
    expect(prefixed.text).toBe(cleaned(svg(RECT)).text)
    const foreign = cleaned(svg(`<x:layer xmlns:x="urn:x"><rect width="5" height="5"/><text>t</text></x:layer>${RECT}`))
    expect(foreign.text).toBe(cleaned(svg(RECT)).text)
    expect(foreign.removed).toContainEqual({ kind: 'element', name: 'x:layer', count: 1 })
  })

  // A prefixed attribute is in its prefix's namespace, never the attribute
  // of its local name (Namespaces in XML 6.2): svg:fill is not fill, and a
  // browser ignores it.
  test('a prefixed attribute bound to the SVG namespace is not the attribute of its local name', () => {
    const result = cleaned(svg('<rect xmlns:s="http://www.w3.org/2000/svg" width="1" height="1" s:fill="red"/>'))
    expect(result.text).not.toContain('fill')
    expect(result.removed).toContainEqual({ kind: 'attribute', name: 's:fill', count: 1 })
  })

  // A root that is not SVG's svg is not an SVG, whatever its name.
  test.each([
    ['another root element', '<html xmlns="http://www.w3.org/1999/xhtml"/>'],
    ['an svg in no namespace', '<svg viewBox="0 0 1 1"/>'],
    ['nothing', ''],
    ['whitespace', '  \n'],
  ])('%s is refused as not-svg', (_, text) => {
    expect(refused(text).code).toBe('not-svg')
  })

  // Unprefixed elements under another default namespace would be another
  // namespace's, which a browser draws none of.
  test('a default namespace other than SVG declared below the root is refused', () => {
    expect(refused(svg('<s:g xmlns:s="http://www.w3.org/2000/svg" xmlns="urn:x"><rect/></s:g>')).message).toBe(
      "svg/g declares another default namespace than SVG's; save it as plain SVG",
    )
    expect(cleaned(svg(`<g xmlns="http://www.w3.org/2000/svg">${RECT}</g>`)).text).toBe(cleaned(svg(RECT)).text)
  })

  // A style inside what is removed would still style the drawing in a
  // browser.
  test('a style inside what is removed is refused', () => {
    expect(refused(svg(`<metadata><style>rect{fill:red}</style></metadata>${RECT}`)).message).toBe(
      'svg holds a style inside what is removed, which a browser would still apply; move the style out of it, or delete the style',
    )
  })
})
