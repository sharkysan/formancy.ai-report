import { describe, expect, test } from 'vitest'
import { MAX_DOCUMENT_NAME_BYTES, MAX_DOCUMENT_NAME_LENGTH, MAX_DOCUMENT_NUMBER_LENGTH, MAX_DOCUMENT_STRING_LENGTH, MAX_DOCUMENT_VALUES } from './limits.js'
import { isStream, type PdfValue } from './model.js'
import { AT_A_BOUND, expectRefused, parsed } from './parse-test-support.js'
import { basic, concat, CONTENT, latin1, onePage, PdfWriter, repeated, withObject5, type XrefEntry } from './test-pdf.js'

/**
 * The object grammar: pdf-lib's, through the reader's own reading of each
 * token -- a name held in one written form, a string as its bytes, a
 * number measured before it is read -- and its own counts of what a file
 * holds. Each value here is object 5 of a one-page file, which the page
 * names.
 */

/** A one-page file whose page names object 5, and whose object stream 6 holds `members`. */
function streamed(members: readonly (readonly [number, string])[]): Uint8Array {
  const w = new PdfWriter()
  basic(w, { page: '/Probe 5 0 R' })
  const members_ = w.objectStream(6, members)
  const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
  for (const [num, entry] of members_) entries.set(num, entry)
  return w.end(w.xrefStream(7, '/Root 1 0 R', entries))
}

/** Object 5 of a file whose object 5 is `body`. */
const object5 = (body: string | Uint8Array): PdfValue | undefined => {
  const value = parsed(withObject5(body)).objects.get(5)
  if (isStream(value)) throw new Error('object 5 is a stream')
  return value
}

describe('a value reads', () => {
  // ISO 32000-1 7.3.4.2: what a literal string's escapes and its ends of
  // line stand for. Read otherwise, a form field's printed value or a
  // font's encoded text would come back as other bytes.
  test("a literal string's escapes and ends of line as ISO 32000 reads them", () => {
    const written = latin1('(a\\n\\r\\t\\b\\f\\(\\)\\\\\\101\\7\\0053\\777\\\nb\r\nc\rd(e)\\q\\\r\nz\\\ry)')
    const bytes = [0x61, 0x0a, 0x0d, 0x09, 0x08, 0x0c, 0x28, 0x29, 0x5c, 0x41, 0x07, 0x05, 0x33, 0xff, 0x62, 0x0a, 0x63, 0x0a, 0x64]
    expect(object5(written)).toEqual({ bytes: Uint8Array.from([...bytes, 0x28, 0x65, 0x29, 0x71, 0x7a, 0x79]) })
  })

  // White space between a hexadecimal string's digits is no byte, and a
  // last digit alone is that digit followed by 0 (7.3.4.3).
  test('a hexadecimal string by its pairs of digits, white space between them, an odd last digit followed by 0', () => {
    expect(object5('<48 65\n6C6c6>')).toEqual({ bytes: Uint8Array.of(0x48, 0x65, 0x6c, 0x6c, 0x60) })
    expect(object5('<>')).toEqual({ bytes: new Uint8Array(0) })
  })

  // Two spellings of one name are one name to every viewer: a dictionary
  // keyed by spelling would hold /Type and /T#79pe as two keys, and a
  // reader and a viewer could each find a different one.
  test('a name in one written form whatever its spelling, a key written twice the last written, an entry of null no entry', () => {
    expect(object5('<</T#79pe/A/Type/B/K null/Z#2fslash/z#2Fslash/#41 1/ 2>>')).toEqual({
      entries: new Map<string, PdfValue>([
        ['Type', { name: 'B' }],
        ['Z#2Fslash', { name: 'z#2Fslash' }],
        ['A', 1],
        ['', 2],
      ]),
    })
  })

  // A number read past its digits, a keyword taken for another, or a reference
  // read as two numbers would give a page another box, another flag or another
  // object; a number past 2^53, as Apple's ENERGY STAR.pdf writes, reads as
  // JavaScript reads it, never refused nor logged.
  test('numbers, booleans, null, comments, and references by their object number', () => {
    expect(object5('[1 -2 +3 .5 -.25 4. true false null % a comment\n 3 0 R 18446744073243310784]')).toEqual([
      1,
      -2,
      3,
      0.5,
      -0.25,
      4,
      true,
      false,
      null,
      { object: 3 },
      Number('18446744073243310784'),
    ])
  })

  // At each token's bound the file reads: a bound that refused what it
  // admits would refuse real files a byte early.
  test('a name, a string and a number at their bounds', () => {
    expect(object5(`/${'A'.repeat(MAX_DOCUMENT_NAME_LENGTH)}`)).toEqual({ name: 'A'.repeat(MAX_DOCUMENT_NAME_LENGTH) })
    expect(object5(`(${'A'.repeat(MAX_DOCUMENT_STRING_LENGTH)})`)).toEqual({ bytes: latin1('A'.repeat(MAX_DOCUMENT_STRING_LENGTH)) })
    expect(object5(`<${'41'.repeat(MAX_DOCUMENT_STRING_LENGTH)}>`)).toEqual({ bytes: latin1('A'.repeat(MAX_DOCUMENT_STRING_LENGTH)) })
    expect(object5('1'.repeat(MAX_DOCUMENT_NUMBER_LENGTH))).toBe(Number('1'.repeat(MAX_DOCUMENT_NUMBER_LENGTH)))
  })

  // A stream's length may be an object written after it, as many writers
  // write it; its data ends where that object says, not where the search
  // for `endstream` found an end.
  test('a stream whose length is a reference, its data what the length says', () => {
    const file = onePage({}, (w) => {
      w.offsets.set(6, w.raw(`6 0 obj\n<</Length 7 0 R>>\nstream\n${'x'.repeat(10)}\r\nendstream\nendobj\n`))
      w.object(7, '10')
      // White space between the data and `endstream`, and no end of line, as some writers leave them.
      w.offsets.set(8, w.raw(`8 0 obj\n<</Length 7 0 R>>\nstream\n${'y'.repeat(10)}  endstream\nendobj\n`))
    })
    const objects = parsed(file).objects
    expect(objects.get(6)).toEqual({ dict: { entries: new Map([['Length', { object: 7 }]]) }, bytes: latin1('x'.repeat(10)) })
    expect(objects.get(8)).toEqual({ dict: { entries: new Map([['Length', { object: 7 }]]) }, bytes: latin1('y'.repeat(10)) })
  })
})

describe('a value is refused', () => {
  // Each token is measured before it is copied: one byte past its bound, in
  // a literal string's escapes or a hexadecimal string's digits too, is
  // refused rather than read whole.
  test('a name, a string or a number past its bound', () => {
    expectRefused(withObject5(`/${'A'.repeat(MAX_DOCUMENT_NAME_LENGTH + 1)}`), 'malformed', 'name-length')
    expectRefused(withObject5(`(${'A'.repeat(MAX_DOCUMENT_STRING_LENGTH + 1)})`), 'malformed', 'string-length')
    expectRefused(withObject5(`(${'\\101'.repeat(MAX_DOCUMENT_STRING_LENGTH + 1)})`), 'malformed', 'string-length')
    expectRefused(withObject5(`<${'41'.repeat(MAX_DOCUMENT_STRING_LENGTH + 1)}>`), 'malformed', 'string-length')
    expectRefused(withObject5(`<${'41'.repeat(MAX_DOCUMENT_STRING_LENGTH)}4>`), 'malformed', 'string-length')
    expectRefused(withObject5('1'.repeat(MAX_DOCUMENT_NUMBER_LENGTH + 1)), 'malformed', 'number-length')
  })

  // A file of tiny values fills the heap long before it passes the byte
  // bound (the spike's X3: twenty mebibytes of empty arrays exhausted half
  // a gigabyte); each value is counted as it is made.
  test('more values than MAX_DOCUMENT_VALUES are refused as too-many-objects', AT_A_BOUND, () => {
    // Names are the cheapest values to read, and each counts twice, as a value and as a name.
    expectRefused(withObject5(concat([latin1('['), repeated('/a ', MAX_DOCUMENT_VALUES / 2), latin1(']')])), 'too-many-objects', 'values')
  })

  // A name costs its bytes for as long as the document is held; a file of
  // long distinct names within every other bound held half a gigabyte of
  // them in the spike.
  test('distinct names past MAX_DOCUMENT_NAME_BYTES are refused as too-many-objects', () => {
    const keys = Math.ceil(MAX_DOCUMENT_NAME_BYTES / 36) + 1
    expectRefused(withObject5(`<<${Array.from({ length: keys }, (_, i) => `/K${String(i).padStart(35, '0')} 0`).join('')}>>`), 'too-many-objects', 'name-bytes')
    // The same name a thousand times is one name's bytes.
    expect(object5(`[${'/Repeated '.repeat(1000)}]`)).toHaveLength(1000)
  })

  // A number sign that escapes no byte is read as itself by some viewers
  // and as an error by others.
  test('a name whose number sign escapes no byte', () => {
    for (const name of ['/A#', '/A#4', '/A#zz', '/A#4 ']) expectRefused(withObject5(name), 'malformed', 'name-escape')
  })

  // Ended by the end of the data rather than by its own delimiter -- in a
  // file, or at the end of an object stream -- a string is cut short.
  test('a string that does not end, and a hexadecimal string with a character that is not a digit', () => {
    expectRefused(withObject5('(no end'), 'malformed', 'string-end')
    expectRefused(streamed([[5, '(no end\\']]), 'malformed', 'string-end')
    expectRefused(withObject5('<4G>'), 'malformed', 'hex-string')
    expectRefused(withObject5('<41'), 'malformed', 'hex-string')
    expectRefused(streamed([[5, '<41']]), 'malformed', 'hex-string')
  })

  // An object number past 2^53 is no number JavaScript holds exactly:
  // read as a float, it would name another object.
  test('an object number past what a number holds exactly', () => {
    expectRefused(
      onePage({}, (w) => w.raw('99999999999999999 0 obj\n1\nendobj\n')),
      'malformed',
      'number',
    )
  })

  // Number() reads `--5` and `+` as NaN, and pdf-lib passes NaN on as a
  // number; the reader refuses it.
  test('a number that is not one', () => {
    for (const body of ['[--5]', '[+]', '[.]', '[-]']) expectRefused(withObject5(body), 'malformed', 'number')
  })

  // An object number is a positive integer and a generation one of 0 to
  // 65,535: anything else names no object, and a reader that rounded it
  // would name one.
  test('a reference that names no object a PDF can hold', () => {
    for (const body of ['[-1 0 R]', '[1.5 0 R]', '[0 0 R]', '[1 65536 R]', '[1 0.5 R]']) expectRefused(withObject5(body), 'malformed', 'reference')
  })

  // What pdf-lib's grammar throws on, a key that is no name or a brace, is a
  // stable refusal in the reader's words, never pdf-lib's message, which
  // quotes the bytes it met.
  test('bytes the grammar cannot follow', () => {
    expectRefused(withObject5('<</A 1 /B> >>'), 'malformed', 'unreadable')
    expectRefused(withObject5('{1}'), 'malformed', 'unreadable')
  })
})

describe('a stream is refused', () => {
  // A stream is an indirect object's whole value (7.3.8); one inside an
  // array, a dictionary or an object stream is data a viewer may or may
  // not find.
  test('inside another object, or inside an object stream', () => {
    expectRefused(withObject5('[<</Length 1>>stream\nx\nendstream]'), 'malformed', 'stream-inside')
    expectRefused(streamed([[5, '<</Length 1>>stream\nx\nendstream']]), 'malformed', 'stream-inside')
  })

  // pdf-lib searches for `endstream` wherever /Length does not land on
  // it; the reader takes the length a stream gives and refuses one that
  // does not end there.
  test('whose length is missing, is not a length, or does not end where it says', () => {
    expectRefused(
      onePage({}, (w) => w.stream(6, '', CONTENT, '5')),
      'malformed',
      'stream-end',
    )
    const raw = (length: string): Uint8Array =>
      onePage({}, (w) => {
        w.offsets.set(6, w.raw(`6 0 obj\n<<${length}>>\nstream\n${CONTENT.length}\nendstream\nendobj\n`))
        w.object(7, '1')
        w.object(8, '/Name')
      })
    expectRefused(raw(''), 'malformed', 'stream-length')
    expectRefused(raw('/Length/Name'), 'malformed', 'stream-length')
    expectRefused(raw('/Length -1'), 'malformed', 'stream-length')
    expectRefused(raw('/Length 2.5'), 'malformed', 'stream-length')
    expectRefused(raw('/Length 8 0 R'), 'malformed', 'stream-length')
    expectRefused(raw('/Length 7 0 R'), 'malformed', 'stream-end')
    expectRefused(raw('/Length 9 0 R'), 'malformed', 'stream-length')
    const endless = onePage({}, (w) => {
      w.offsets.set(6, w.raw('6 0 obj\n<</Length 7 0 R>>\nstream\nno end\n'))
    })
    expectRefused(endless, 'malformed', 'stream-end')
  })

  // A length written later that runs past the `endstream` after the data
  // would take that keyword and what follows as the stream's bytes.
  test('whose length is longer than the data before `endstream`', () => {
    const file = onePage({}, (w) => {
      w.offsets.set(6, w.raw('6 0 obj\n<</Length 7 0 R>>\nstream\nshort\nendstream\nendobj\n'))
      w.object(7, '100')
    })
    expectRefused(file, 'malformed', 'stream-end')
  })
})
