import { PDFArray, PDFDict, PDFNumber } from '@pdfme/pdf-lib'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Grammar } from './grammar.js'
import { MAX_DOCUMENT_NAME_BYTES, MAX_DOCUMENT_NAME_LENGTH, MAX_DOCUMENT_NUMBER_LENGTH, MAX_DOCUMENT_STRING_LENGTH, MAX_DOCUMENT_VALUES } from './limits.js'
import { isRef, isStream, resolved, type PdfDict, type PdfString, type PdfValue } from './model.js'
import { AT_A_BOUND, expectRefused, parsed } from './parse-test-support.js'
import { Reading } from './reading.js'
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

afterEach(() => {
  vi.restoreAllMocks()
})

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
    // In the place it was first written, as pdf-lib's map keeps it, a null between them or not: a Map compares unordered.
    expect([...(object5('<</A 1/B 2/A null/A 3/C null>>') as PdfDict).entries]).toEqual([
      ['A', 3],
      ['B', 2],
    ])
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
  test('a name, a string and a number at their bounds', AT_A_BOUND, () => {
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
  test('a name, a string or a number past its bound', AT_A_BOUND, () => {
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
  test('distinct names past MAX_DOCUMENT_NAME_BYTES are refused as too-many-objects', AT_A_BOUND, () => {
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

  // A fraction of an object number, or a generation past 65,535, names an
  // object only to a reader that rounds it, and it would name one: refused.
  test('a reference that names no object a PDF can hold', () => {
    for (const body of ['[1.5 0 R]', '[1 65536 R]', '[1 0.5 R]']) expectRefused(withObject5(body), 'malformed', 'reference')
  })

  // The spike's sample: Apple's ENERGY STAR guide gives fifteen structure
  // elements a /Pg of 18446744073386460000 0 R, a negative object number
  // written through 2^64, and was refused for it. A whole number below 1 or
  // past what a number holds exactly is no object a file can define --
  // every object is listed below /Size, itself within the bound -- and a
  // viewer reads a reference to an object that does not exist as null
  // (ISO 32000-1 7.3.10), as PDF.js does these. Read so, as one reference
  // to nothing, however many numbers name it.
  test('a reference to a whole object number no file can define names no object', () => {
    const document = parsed(withObject5('[-1 0 R 0 0 R 18446744073386460000 0 R 9007199254740993 0 R 18446744073386460001 1 R]'))
    const refs = document.objects.get(5) as readonly PdfValue[]
    expect(refs.map((ref) => isRef(ref) && resolved(document.objects, ref))).toEqual([null, null, null, null, null])
    expect(new Set(refs).size).toBe(1)
  })

  // What pdf-lib's grammar throws on, a key that is no name or a brace, is a
  // stable refusal in the reader's words, never pdf-lib's message, which
  // quotes the bytes it met.
  test('bytes the grammar cannot follow', () => {
    expectRefused(withObject5('<</A 1 /B> >>'), 'malformed', 'unreadable')
    expectRefused(withObject5('{1}'), 'malformed', 'unreadable')
  })
})

describe('what a value costs', () => {
  // The values bound, measured on this reader: a file of two million
  // numbers took 1.75 s, past the second a document may take, two thirds
  // of it in its numbers -- each read twice, the second time as the look
  // for a reference's generation, and each made a pdf-lib PDFNumber, whose
  // constructor writes the number's string form. Each number a file
  // writes, a generation among them, is read once, and is a number of the
  // model from the first.
  test('each number is read once, and no pdf-lib number is made of it', () => {
    const raw = vi.spyOn(Grammar.prototype as unknown as { parseRawNumber: () => number }, 'parseRawNumber')
    const made = vi.spyOn(PDFNumber, 'of')
    const { value } = new Grammar(latin1('[1 2 3 4 5 0 R -2.5 0.5 +7 123456789012345678 6 7 8]'), new Reading()).indirect()
    expect(value).toEqual([1, 2, 3, 4, { object: 5 }, -2.5, 0.5, 7, 123456789012345680, 6, 7, 8])
    expect(raw).toHaveBeenCalledTimes(13)
    expect(made).not.toHaveBeenCalled()
  })

  // The `worst` file of the spike, two million values in dictionaries
  // shaped as a page's, beside content that inflates to the budget, took
  // 1.0 s on this reader: every array and dictionary made first as pdf-lib's
  // own, its /Type looked up in pdf-lib's pool of names, then walked again
  // into the model. The grammar makes the model's as it reads.
  test("no pdf-lib array or dictionary is made of a file's containers", () => {
    const arrays = vi.spyOn(PDFArray, 'withContext')
    const dicts = vi.spyOn(PDFDict, 'fromMapWithContext')
    const { value } = new Grammar(latin1('<</Type/Page/Kids[1 0 R [2] <</A null>>]/B<<>>>>'), new Reading()).indirect()
    expect(value).toEqual({
      entries: new Map<string, PdfValue>([
        ['Type', { name: 'Page' }],
        ['Kids', [{ object: 1 }, [2], { entries: new Map() }]],
        ['B', { entries: new Map() }],
      ]),
    })
    expect(arrays).not.toHaveBeenCalled()
    expect(dicts).not.toHaveBeenCalled()
  })

  // X4, measured on this reader: ten million empty strings, refused at the
  // values bound, held 445 MiB first -- each string a typed array of its
  // own over a buffer of its own, 248 bytes of heap however short (a view
  // is 136, a shared empty one 40, measured over two million in Node
  // 22.23.3 on 6 November 2026). A string the file writes as it reads is a
  // view of the parse's own copy of the file; one escaped or hexadecimal,
  // a view of the bytes the document's strings are decoded into together;
  // an empty one, the one empty array, which holds nothing to change.
  test("a string holds a view of the file's bytes, or of its document's decoded strings, and an empty one none of its own", () => {
    const [ab, cd, escaped, hex, empty, none] = object5('[(ab) (cd) (e\\nf) <4142> () <>]') as readonly PdfString[] as readonly { bytes: Uint8Array }[]
    expect([ab, cd, escaped, hex].map((each) => String.fromCharCode(...(each?.bytes ?? [])))).toEqual(['ab', 'cd', 'e\nf', 'AB'])
    expect(ab?.bytes.buffer).toBe(cd?.bytes.buffer)
    expect(escaped?.bytes.buffer).toBe(hex?.bytes.buffer)
    expect(escaped?.bytes.buffer).not.toBe(ab?.bytes.buffer)
    expect(empty?.bytes).toBe(none?.bytes)
    expect(empty?.bytes).toHaveLength(0)
  })

  // A string is counted twice against MAX_DOCUMENT_VALUES -- the value, and
  // the view its bytes are held in, which costs what several values do --
  // so that a file of short strings is refused at half as many as a file
  // of numbers. The sample's 1,484 files hold at most 298 strings, a
  // 1,000-page tagged report one.
  test('a string is counted twice against MAX_DOCUMENT_VALUES', AT_A_BOUND, () => {
    const half = MAX_DOCUMENT_VALUES / 2
    parsed(withObject5(concat([latin1('['), repeated('1 ', half), latin1(']')])))
    expectRefused(withObject5(concat([latin1('['), repeated('() ', half), latin1(']')])), 'too-many-objects', 'values')
    expectRefused(withObject5(concat([latin1('['), repeated('<> ', half), latin1(']')])), 'too-many-objects', 'values')
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
