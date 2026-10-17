import { describe, expect, test } from 'vitest'
import { element, leaf, xmlDocument } from './xml.js'

/**
 * The XML an e-invoice is written as: a tree of elements serialised one
 * way, byte for byte the same for the same tree, its text escaped so that
 * a parser gives back exactly what was written, and a character XML 1.0
 * cannot hold never written at all.
 */

describe('an XML document', () => {
  // A file that differs between two renders of the same invoice is two
  // files, and a hash or a byte comparison of the PDF says the invoice
  // changed when it did not. One declaration, no byte order mark, a line
  // feed after every line and none of the machine's own line ends, two
  // spaces for each level, an element with nothing in it closed at once.
  test('is written one way: its declaration, two spaces a level, a line feed after each line', () => {
    const tree = element('a:root', [element('a:empty', []), element('a:holds', [leaf('a:text', 'one'), undefined, leaf('a:none', '')])], [['xmlns:a', 'urn:example']])
    const xml = xmlDocument(tree)
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<a:root xmlns:a="urn:example">',
        '  <a:empty/>',
        '  <a:holds>',
        '    <a:text>one</a:text>',
        '    <a:none></a:none>',
        '  </a:holds>',
        '</a:root>',
        '',
      ].join('\n'),
    )
    expect(xml.charCodeAt(0)).toBe(0x3c)
    expect(xml).not.toContain('\r')
    expect(xmlDocument(tree)).toBe(xml)
  })

  // A name with an ampersand or an address with an angle bracket would
  // otherwise make a file that is not XML, or one whose parser reads
  // another name. Quotes need no escaping in text; an attribute is quoted
  // with double quotes, so those are.
  test('escapes &, < and > in text, and the double quote in an attribute too', () => {
    const xml = xmlDocument(element('root', [leaf('name', 'Müller & Söhne <AG> "x" \'y\'', [['note', 'a "b" & <c>']])]))
    expect(xml).toContain('<name note="a &quot;b&quot; &amp; &lt;c&gt;">Müller &amp; Söhne &lt;AG&gt; "x" \'y\'</name>')
  })

  // A parser turns a carriage return in text into a line feed (XML 1.0,
  // 2.11), and a tab, a line feed or a carriage return in an attribute into
  // a space (3.3.3). Written as references they come back as written; a
  // line feed and a tab in text come back as they are.
  test('writes the white space a parser would change as references, and no other', () => {
    const xml = xmlDocument(element('root', [leaf('text', 'one\r\ntwo\tthree', [['attribute', 'a\tb\nc\rd']])]))
    expect(xml).toContain('<text attribute="a&#9;b&#10;c&#13;d">one&#13;\ntwo\tthree</text>')
  })

  // Dropping a character changes what the invoice says, and writing one
  // XML 1.0 forbids makes a file no parser reads. The rules refuse such a
  // text where it is read, naming the term; one that reaches the writer
  // anyway is a defect, and is said as one, never written. DEL, the C1
  // controls and a pair of surrogates XML allows, and they are written.
  test('refuses a character XML 1.0 cannot write, in text or in an attribute, as a defect', () => {
    for (const character of ['\u0000', '\u0008', '\u000b', '\u001f', '\ud800', '\udfff', '￾', '￿']) {
      expect(() => xmlDocument(element('root', [leaf('text', `a${character}b`)])), character.codePointAt(0)?.toString(16)).toThrow(RangeError)
      expect(() => xmlDocument(element('root', [], [['attribute', `a${character}b`]]))).toThrow(RangeError)
    }
    expect(xmlDocument(element('root', [leaf('text', '\u007f\u0085\u{1f600}')]))).toContain('<text>\u007f\u0085\u{1f600}</text>')
  })
})
