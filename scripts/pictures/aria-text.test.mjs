import { describe, expect, test } from 'vitest'
import { decode, occursIn, steadied, strings } from './aria-text.mjs'

/**
 * The decoder a README picture's quotes are checked through. A caption
 * quotes what a person reads; the record holds Playwright's accessibility
 * snapshot, which is YAML-escaped text. Matched against the escaped form, a
 * quote with a quotation mark or a colon in it would miss although the page
 * shows it, or hit a run that only exists in the escaping.
 *
 * Each line says where it came from: printed by `locator.ariaSnapshot()`
 * (Playwright 1.64.1, Chromium 156.0.8078.4) on a part of one of the
 * Studio's scenes, 2026-10-16, or made by hand for a shape no pictured
 * part has.
 */

describe('decode', () => {
  // A plain value is the text as written: decoding it must not touch it.
  test('reads a plain value as written', () => {
    // studio-refusal, part Builder.
    expect(decode('    - textbox "Show only when" [invalid]: row.value > 1000')).toEqual([
      { depth: 2, role: 'textbox', name: 'Show only when', value: 'row.value > 1000' },
    ])
  })

  // Playwright quotes a value that holds a colon before a space, a quotation
  // mark or a control character, and escapes `\"` and `\xHH`; JSON knows the
  // first and not the second. A decoder that left them would make the
  // Preview's status unquotable, and a \x escape a line it cannot read.
  test('reads a double-quoted value, with an escaped quotation mark and a \\x escape', () => {
    // studio-react, part Preview.
    expect(decode('  - status: "Preview: printed."')).toEqual([{ depth: 1, role: 'status', name: undefined, value: 'Preview: printed.' }])
    // Made by hand: no pictured part has a straight quotation mark in a
    // quoted value, or a DEL character. The escaped backslash before "x41"
    // keeps that "x41" text, not an escape.
    expect(decode('- paragraph: "The style \\"strong\\": unused"')).toEqual([
      { depth: 0, role: 'paragraph', name: undefined, value: 'The style "strong": unused' },
    ])
    expect(decode('- text: "a\\x7fb \\\\x41"')).toEqual([{ depth: 0, role: 'text', name: undefined, value: 'a\u007fb \\x41' }])
  })

  // A key with ": " in it is single-quoted, with '' for an apostrophe. Read
  // without stripping them, the name would be lost to the YAML.
  test("reads a single-quoted key, with '' standing for '", () => {
    // studio-react, part Builder.
    expect(decode(`      - 'treeitem "Nummer: [Nummer]" [level=2]'`)).toEqual([{ depth: 3, role: 'treeitem', name: 'Nummer: [Nummer]', value: undefined }])
    // Made by hand: the same shape with an apostrophe in the name.
    expect(decode(`- 'button "Ada''s: draft" [pressed]': Saved`)).toEqual([{ depth: 0, role: 'button', name: "Ada's: draft", value: 'Saved' }])
  })

  // A name is JSON.stringify's output, so an escaped quotation mark in it is
  // the mark itself, and the attributes after it are not part of it.
  test('reads a name with an escaped quotation mark, and its attributes apart from it', () => {
    // studio-react, part Builder: a name and its attribute.
    expect(decode('    - button "Undo" [disabled]')).toEqual([{ depth: 2, role: 'button', name: 'Undo', value: undefined }])
    // Made by hand: no pictured name has a straight quotation mark.
    expect(decode('- heading "Say \\"hi\\"" [level=3]:')).toEqual([{ depth: 0, role: 'heading', name: 'Say "hi"', value: undefined }])
  })

  // A link's address is a property, not text a heading or a field says; it
  // is read, under its own key, rather than refused.
  test('reads a property line', () => {
    // studio-react, part Preview, as the camera records it.
    expect(decode('    - /url: blob:http://studio.invalid/<uuid>')).toEqual([
      { depth: 2, role: '/url', name: undefined, value: 'blob:http://studio.invalid/<uuid>' },
    ])
  })

  // A line the format above does not describe would otherwise be skipped, and
  // a quote it holds would be "missing" for a reason nobody could see.
  test.each([
    ['no list marker', 'status: Saved.'],
    ['an odd indentation', ' - status: Saved.'],
    ['an unclosed value', '- status: "Saved.'],
    ['a key that is not a role', '- Saved.'],
    ['an unclosed single-quoted key', `- 'option "None: x"`],
    ['trailing text after a name', '- button "Save" now'],
  ])('refuses a line with %s', (_, line) => {
    expect(() => decode(line)).toThrow(/line 1 is not an accessibility snapshot line/)
  })
})

describe('occursIn', () => {
  // studio-refusal, part Preview, as printed.
  const snapshot = [
    '- region "Preview":',
    '  - heading "Preview" [level=2]',
    '  - status: "Preview: refused by the runtime, 1 problem."',
    '  - list "Why the preview was not printed":',
    '    - listitem:',
    '      - code: expressions expression-out-of-scope',
    "      - text: row has a value only in a table's cells and what an aggregate reads from each row",
    '      - button "Select Book value"',
  ].join('\n')

  // A quote is held by what one element says: a run that only exists when two
  // lines are read together is not something a person reads in one place.
  test('finds a quote inside one name or value, and not across two', () => {
    expect(occursIn('Select Book value', snapshot)).toBe(true)
    expect(occursIn('refused by the runtime, 1 problem.', snapshot)).toBe(true)
    expect(occursIn('expression-out-of-scope', snapshot)).toBe(true)
    expect(occursIn('expression-out-of-scope row has a value', snapshot)).toBe(false)
  })

  // The escaping is not text: a quote of a quotation mark finds the mark, and
  // the backslash Playwright put before it finds nothing.
  test('matches the decoded text, not the escaping', () => {
    const escaped = '- paragraph: "The style \\"strong\\": unused"'
    expect(occursIn('The style "strong"', escaped)).toBe(true)
    expect(occursIn('\\"strong', escaped)).toBe(false)
  })
})

describe('strings', () => {
  // Every name and value, in order: what a reader of a part's text reads.
  test('lists every decoded name and value, in order', () => {
    expect(strings('- textbox "Title": Offerte\n- button "Undo" [disabled]')).toEqual(['Title', 'Offerte', 'Undo'])
  })
})

describe('steadied', () => {
  // Printed by `locator.ariaSnapshot()` (Playwright 1.64.1, Chromium
  // 156.0.8078.4) on 2026-10-16, of the Preview's Download PDF link on an
  // http://studio.invalid page; the UUIDs are two such prints'.
  const printed = (uuid) => ['- link "Download PDF":', `  - /url: blob:http://studio.invalid/${uuid}`].join('\n')

  // The browser draws a new UUID for every object URL, so a part holding the
  // download link would be recorded with one walk's UUID and differ from it
  // on every walk after: the check would fail with nothing changed, and a
  // retake would change the record each time.
  test("says a link's object URL without the UUID drawn for it", () => {
    expect(steadied(printed('582ce280-e0a1-470b-85f7-489fefba9c25'))).toBe(steadied(printed('8fee9cd5-3895-4b02-9533-25a9b8abc372')))
    expect(steadied(printed('582ce280-e0a1-470b-85f7-489fefba9c25'))).toBe(['- link "Download PDF":', '  - /url: blob:http://studio.invalid/<uuid>'].join('\n'))
  })

  // Made by hand: anything else is what the page says, and a record that
  // smoothed it would hold a change nobody saw -- another address, or text
  // that only looks like an object URL.
  test('leaves every other address and every text as printed', () => {
    const other = [
      '- link "Skip to the builder":',
      '  - /url: "#studio-main"',
      '- link "Download":',
      '  - /url: https://studio.invalid/582ce280-e0a1-470b-85f7-489fefba9c25',
      '- paragraph: blob:http://studio.invalid/582ce280-e0a1-470b-85f7-489fefba9c25',
    ].join('\n')
    expect(steadied(other)).toBe(other)
  })
})
