import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { MAX_DOCUMENT_OBJECTS } from './limits.js'
import { expectRefused, parsed } from './parse-test-support.js'
import { basic, claimingXrefStream, concat, CONTENT, latin1, onePage, PdfWriter, type XrefEntry } from './test-pdf.js'

/**
 * The cross-reference: read section by section, as the loop meets each,
 * chained from the last `startxref` through /Prev and /XRefStm, newest
 * first, and held to the objects the loop read -- the last definition of
 * each number the one it names. Where they disagree a viewer may print one
 * and a recovering viewer another, so the file is refused, never printed
 * one way.
 */

/** Every offset the writer kept, as entries a cross-reference stream gives. */
const atOffsets = (w: PdfWriter): Map<number, XrefEntry> => new Map([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))

/** Catalog 1 and page tree 2 in object stream 5, page 3 and content 4 at the top level, and the cross-reference stream 6 that finds them. */
function inObjectStream(change?: (entries: Map<number, XrefEntry>) => void): Uint8Array {
  const w = new PdfWriter()
  w.object(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>')
  w.stream(4, '', CONTENT)
  const entries = atOffsets(w)
  for (const [num, entry] of w.objectStream(5, [
    [1, '<</Type/Catalog/Pages 2 0 R>>'],
    [2, '<</Type/Pages/Kids[3 0 R]/Count 1>>'],
  ]))
    entries.set(num, entry)
  entries.set(5, { kind: 'at', offset: w.offsets.get(5) ?? 0 })
  change?.(entries)
  return w.end(w.xrefStream(6, '/Root 1 0 R', entries))
}

/** A one-page file whose object 5 is written at generation 1, the cross-reference giving it so, and whose page names it by `reference`. */
function generation(reference: string): Uint8Array {
  const w = new PdfWriter()
  basic(w, { page: `/Probe ${reference}` })
  w.object(5, '<</Written 1>>', 1)
  const entries = atOffsets(w)
  entries.set(5, { kind: 'at', offset: w.offsets.get(5) ?? 0, gen: 1 })
  return w.end(w.xrefStream(6, '/Root 1 0 R', entries))
}

/** A one-page file whose classic cross-reference is `entries` (objects 1 to 4 as written, unless replaced), with `trailer` after /Root. */
function table(change: (w: PdfWriter, entries: Map<number, number | 'free'>) => void, trailer = ''): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const entries = new Map<number, number | 'free'>(w.offsets)
  change(w, entries)
  return w.end(w.xref(`/Root 1 0 R${trailer}`, entries))
}

describe('the cross-reference reads', () => {
  // A writer that packs its small objects into object streams leaves only
  // the streams at the top level: a reader that did not read them would
  // find no catalog.
  test('objects in an object stream, as a newer writer writes them', () => {
    const document = parsed(inObjectStream())
    expect(document.catalog.entries.get('Type')).toEqual({ name: 'Catalog' })
    expect(document.pages).toEqual([3])
  })

  // Acrobat's hybrid files: a classic table for older readers, and an
  // /XRefStm for the objects only a newer reader finds, in object streams.
  test('a hybrid file: a classic table, and the cross-reference stream its /XRefStm names', () => {
    const w = new PdfWriter()
    basic(w)
    const members = w.objectStream(5, [[7, '<</Note true>>']])
    const stream = w.xrefStream(6, '', members, false, false)
    const at = w.xref(`/Root 1 0 R/XRefStm ${stream}`, new Map([1, 2, 3, 4, 5].map((num) => [num, w.offsets.get(num) ?? 0])))
    expect(parsed(w.end(at)).objects.get(7)).toEqual({ entries: new Map([['Note', true]]) })
  })

  // The decision the spike's sample made: Apple's Quartz writes an unused
  // object number as in use at offset 0, the header, where no object can
  // stand (265 entries in 150 of the sample's files). Read as what it is
  // to every viewer, nothing, and so is an entry past the end. An entry
  // anywhere else names a place a viewer might find an object the reader
  // never read.
  test('an entry in use at offset 0 or past the end names no object, and anywhere else is refused', () => {
    const nothing = table((_, entries) => {
      entries.set(5, 0)
      entries.set(6, 1_000_000_000)
    })
    expect([...parsed(nothing).objects.keys()].sort()).toEqual([1, 2, 3, 4])
    const inside = table((w, entries) => entries.set(5, (w.offsets.get(4) ?? 0) + 30))
    expectRefused(inside, 'xref-disagrees', 'missing')
    expectRefused(
      inObjectStream((entries) => entries.set(7, { kind: 'in', stream: 5, index: 9 })),
      'xref-disagrees',
      'missing',
    )
  })

  // An update that deletes an object -- a removed annotation -- marks it
  // free and leaves its old bytes where they were. Every viewer reads it
  // as nothing; so does the reader, and the file is not refused for it.
  test('an object an update frees is no object', () => {
    const w = new PdfWriter()
    basic(w)
    w.object(5, '<</Old true>>')
    const first = w.xref('/Root 1 0 R')
    w.raw(`startxref\n${first}\n%%EOF\n`)
    const document = parsed(w.end(w.xref(`/Root 1 0 R/Prev ${first}`, new Map([[5, 'free']]), 6)))
    expect(document.objects.has(5)).toBe(false)
  })

  // An object written at generation 1, as a writer writes a number it
  // reused, and named by a reference at that generation.
  test('an object at another generation than 0, named at its own', () => {
    expect(parsed(generation('5 1 R')).objects.get(5)).toEqual({ entries: new Map([['Written', 1]]) })
  })

  // Two entries for one number in one section: the first is the entry,
  // as PDF.js reads it, in a table and in a stream alike.
  test('the first of two entries one section gives a number', () => {
    const w = new PdfWriter()
    basic(w)
    const lines = [1, 2, 3, 4].map((num) => `${String(w.offsets.get(num)).padStart(10, '0')} 00000 n \n`).join('')
    const at = w.raw(`xref\n0 5\n0000000000 65535 f \n${lines}3 1\n0000000009 00000 n \ntrailer\n<</Size 5/Root 1 0 R>>\n`)
    expect(parsed(w.end(at)).pages).toEqual([3])
    const s = new PdfWriter()
    basic(s)
    const rows = new Uint8Array(7 * 7)
    const view = new DataView(rows.buffer)
    const xref = s.length
    for (const [num, offset] of [...s.offsets, [5, xref] as const]) {
      rows[num * 7] = 1
      view.setUint32(num * 7 + 1, offset)
    }
    s.stream(5, '/Type/XRef/Size 6/Index[0 6 3 1]/W[1 4 2]/Root 1 0 R/Filter/FlateDecode', deflate(rows))
    expect(parsed(s.end(xref)).pages).toEqual([3])
  })

  // /W may give no width to the type, which is then 1: every row an object at an offset.
  test('a cross-reference stream whose rows carry no type', () => {
    expect(parsed(claimingXrefStream('6', [0, 4, 2], '0 6')).pages).toEqual([3])
  })

  // A cross-reference stream need not list itself: nothing names it.
  test('a cross-reference stream that does not list its own number', () => {
    const w = new PdfWriter()
    basic(w)
    expect(parsed(w.end(w.xrefStream(5, '/Root 1 0 R', atOffsets(w), false, false))).pages).toEqual([3])
  })
})

describe('the cross-reference is refused', () => {
  test('where it lists no definition the file holds, or places one elsewhere', () => {
    expectRefused(
      table((w) => w.object(5, '1')),
      'xref-disagrees',
      'unlisted',
    )
    expectRefused(
      table((w, entries) => entries.set(4, (w.offsets.get(4) ?? 0) + 1)),
      'xref-disagrees',
      'misplaced',
    )
    expectRefused(
      inObjectStream((entries) => entries.set(1, { kind: 'in', stream: 5, index: 1 })),
      'xref-disagrees',
      'misplaced',
    )
    // Members of an object stream the chain frees are found by no viewer.
    expectRefused(
      inObjectStream((entries) => entries.set(5, { kind: 'free' })),
      'xref-disagrees',
      'missing',
    )
  })

  // A reference names an object and its generation; a viewer that finds
  // another generation at the object's place may go looking for the
  // object elsewhere.
  test('where a reference names a generation it does not give', () => {
    expectRefused(onePage({ page: '/Probe 4 1 R' }), 'xref-disagrees', 'generation')
    expectRefused(generation('5 0 R'), 'xref-disagrees', 'generation')
  })

  test('where `startxref`, /Prev or /XRefStm names no cross-reference, or they name one another in a cycle', () => {
    const w = new PdfWriter()
    basic(w)
    w.xref('/Root 1 0 R')
    expectRefused(w.end(9), 'xref-disagrees', 'startxref')
    const past = new PdfWriter()
    basic(past)
    past.xref('/Root 1 0 R')
    expectRefused(past.end(1_000_000_000), 'xref-disagrees', 'startxref')
    // A place that reads as an object's first two numbers and no `obj`: the content's `0 0 m`.
    const data = new PdfWriter()
    basic(data)
    data.xref('/Root 1 0 R')
    expectRefused(data.end((data.offsets.get(4) ?? 0) + '4 0 obj\n<</Length 18>>\nstream\n'.length), 'xref-disagrees', 'startxref')
    expectRefused(
      table(() => undefined, '/Prev/Name'),
      'xref-disagrees',
      'prev',
    )
    expectRefused(
      table(() => undefined, '/Prev 9'),
      'xref-disagrees',
      'prev',
    )
    expectRefused(
      table(() => undefined, '/XRefStm 9'),
      'xref-disagrees',
      'xref-stream-nowhere',
    )
    const cycle = new PdfWriter()
    basic(cycle)
    const at = cycle.length
    expectRefused(cycle.end(cycle.xref(`/Root 1 0 R/Prev ${at}`)), 'malformed', 'prev-cycle')
  })

  test('where no `startxref` says where it is', () => {
    const whole = onePage()
    const startxref = latin1('startxref')
    let at = whole.length - startxref.length
    while (!startxref.every((byte, i) => whole[at + i] === byte)) at -= 1
    expectRefused(concat([whole.subarray(0, at), latin1('%%EOF\n')]), 'malformed', 'no-startxref')
  })

  test('where its trailer names no catalog', () => {
    const w = new PdfWriter()
    basic(w)
    expectRefused(w.end(w.xref('/Root 3 0 R')), 'malformed', 'no-catalog')
    const none = new PdfWriter()
    basic(none)
    expectRefused(none.end(none.xref('')), 'malformed', 'no-catalog')
  })

  // An encrypted file is refused as encrypted wherever its /Encrypt is
  // named: the last trailer is read before the parse, an earlier one as
  // the loop meets it.
  test('where an earlier section is encrypted', () => {
    const w = new PdfWriter()
    basic(w)
    w.object(5, '<</Filter/Standard/V 2/R 3/Length 128/P -4/O<00>/U<00>>>')
    const first = w.xref('/Root 1 0 R/Encrypt 5 0 R')
    w.raw(`startxref\n${first}\n%%EOF\n`)
    w.object(6, '1')
    expectRefused(w.end(w.xref(`/Root 1 0 R/Prev ${first}`, new Map([[6, w.offsets.get(6) ?? 0]]), 7)), 'encrypted', 'encrypted')
  })

  test('where a table is not written as a table', () => {
    const w = new PdfWriter()
    basic(w)
    expectRefused(w.end(w.raw('xref\n0 2\n0000000000 65535 f \n0000000015 00000 x \ntrailer\n<</Root 1 0 R>>\n')), 'malformed', 'xref-entry')
    const bare = new PdfWriter()
    basic(bare)
    expectRefused(bare.end(bare.raw('xref\n0 1\n0000000000 65535 f \n')), 'malformed', 'xref-trailer')
    expectRefused(
      onePage({}, (writer) => writer.raw('trailer\n<<>>\n')),
      'malformed',
      'trailer-alone',
    )
    expectRefused(
      table(() => undefined, `/Size ${MAX_DOCUMENT_OBJECTS + 2}`),
      'too-many-objects',
      'xref-claim',
    )
  })

  // pdf-lib's row reader trusts /Size, /W and /Index; the reader reads
  // them first and refuses a stream that does not say what its rows are.
  test('where a cross-reference stream does not say how its rows are laid out', () => {
    expectRefused(claimingXrefStream('6', [1, 4, 2], '0'), 'malformed', 'xref-stream')
    expectRefused(claimingXrefStream('/Six', [1, 4, 2], '0 6'), 'malformed', 'xref-stream')
    expectRefused(claimingXrefStream('6', [1, 4, 2], '0 -6'), 'malformed', 'xref-stream')
    const w = new PdfWriter()
    basic(w)
    const at = w.length
    w.stream(5, '/Type/XRef/Size 6/W[1 4]/Root 1 0 R/Filter/FlateDecode', deflate(new Uint8Array(30)))
    expectRefused(w.end(at), 'malformed', 'xref-stream')
  })

  test('where an object stream does not say how its objects are laid out, or claims more than a document may hold', () => {
    const stream = (dict: string, data: string): Uint8Array => {
      const w = new PdfWriter()
      basic(w)
      w.stream(5, `/Type/ObjStm${dict}/Filter/FlateDecode`, deflate(latin1(data)))
      return w.end(w.xrefStream(6, '/Root 1 0 R', atOffsets(w)))
    }
    expectRefused(stream('/First 4', '7 0 1'), 'malformed', 'object-stream')
    expectRefused(stream('/N 1/First 4', '0 0 1'), 'malformed', 'object-stream')
    expectRefused(stream('/N 1/First -4', '7 0 1'), 'malformed', 'object-stream')
    expectRefused(stream('/N 1/First 4', '7 9 1'), 'malformed', 'object-stream-offset')
    expectRefused(stream(`/N ${MAX_DOCUMENT_OBJECTS}/First 4`, '7 0 1'), 'too-many-objects', 'objects')
  })

  test('where an object does not begin or end as an object does', () => {
    expectRefused(
      onePage({}, (w) => w.raw('5 0 bj\n1\nendobj\n')),
      'malformed',
      'object-header',
    )
    expectRefused(
      onePage({}, (w) => w.raw('5 0 obj\n1 2\nendobj\n')),
      'malformed',
      'object-end',
    )
  })

  // Acrobat looks for %%EOF in a file's last 1,024 bytes (ISO 32000-1,
  // Annex H): a file whose end lies further back is one it may refuse.
  test('where its end lies more than 1,024 bytes before its last', () => {
    expectRefused(concat([onePage(), latin1(' '.repeat(1100))]), 'malformed', 'eof-far')
    parsed(concat([onePage(), latin1(' '.repeat(1000))]))
  })
})
