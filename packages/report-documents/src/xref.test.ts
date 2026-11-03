import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_XREF_ENTRIES, MAX_DOCUMENT_XREF_SECTIONS } from './limits.js'
import { expectRefused, parsed } from './parse-test-support.js'
import { claimingXrefStream, emptySections, unchainedStreams, unchainedTables } from './test-hostile.js'
import { basic, concat, CONTENT, latin1, MIB, onePage, PdfWriter, repeated, type XrefEntry } from './test-pdf.js'

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

/**
 * A one-page file whose object stream 5 holds `body` after a header of
 * `pairs` -- each member's number and offset -- its /First where the body
 * begins unless given, and whose cross-reference stream lists each member
 * in it by its index.
 */
function membered(pairs: readonly (readonly [number, number])[], body: string | Uint8Array, first?: number): Uint8Array {
  const w = new PdfWriter()
  basic(w)
  const header = latin1(`${pairs.map(([num, offset]) => `${num} ${offset}`).join(' ')}\n`)
  const data = concat([header, typeof body === 'string' ? latin1(body) : body])
  w.stream(5, `/Type/ObjStm/N ${pairs.length}/First ${first ?? header.length}/Filter/FlateDecode`, deflate(data, { level: 1 }))
  const entries = atOffsets(w)
  pairs.forEach(([num], index) => entries.set(num, { kind: 'in', stream: 5, index }))
  return w.end(w.xrefStream(6, '/Root 1 0 R', entries))
}

/**
 * A one-page file of two revisions: the first places object 7 in object
 * stream 5, the second, after it, writes object 5 again as `replaced` and
 * lists only object 5, its /Prev the first; the chain still places 7 in 5.
 */
function replacedContainer(replaced: string): Uint8Array {
  const w = new PdfWriter()
  basic(w, { page: '/Probe 7 0 R' })
  const entries = atOffsets(w)
  for (const [num, entry] of w.objectStream(5, [[7, '<</Old true>>']])) entries.set(num, entry)
  entries.set(5, { kind: 'at', offset: w.offsets.get(5) ?? 0 })
  const first = w.xrefStream(6, '/Root 1 0 R', entries)
  w.raw(`startxref\n${first}\n%%EOF\n`)
  if (replaced.includes('ObjStm')) w.stream(5, replaced, deflate(latin1('7 0 <</New true>>')))
  else w.object(5, replaced)
  return w.end(w.xref(`/Root 1 0 R/Prev ${first}`, new Map([[5, w.offsets.get(5) ?? 0]]), 8))
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
  // An object the chain does not list, or places at another offset or
  // index than where it was read, is one a viewer that follows the chain
  // does not find, and one that recovers by scanning does.
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

  // A chain that leads nowhere leaves a viewer to recover by scanning the
  // file, which may read objects the chain would not; a cycle never ends.
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

  // Without `startxref` the chain has no start, and a viewer reads whatever
  // its recovery finds.
  test('where no `startxref` says where it is', () => {
    const whole = onePage()
    const startxref = latin1('startxref')
    let at = whole.length - startxref.length
    while (!startxref.every((byte, i) => whole[at + i] === byte)) at -= 1
    expectRefused(concat([whole.subarray(0, at), latin1('%%EOF\n')]), 'malformed', 'no-startxref')
  })

  // A /Root that names a page, or no /Root at all: pdf-lib takes any
  // catalog it finds instead; the reader reads the one the trailer names.
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

  // An entry that is neither in use nor free, a table with no trailer, a
  // trailer with no table, and a /Size past the bound are each read some
  // other way by some viewer.
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

  // An object stream without /N, with a negative /First, a member numbered
  // 0 or placed past its end cannot be read as written; one that claims more
  // members than a document may hold is refused before it is inflated.
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

  // `5 0 bj` and an object of two values are bytes the loop would have to
  // guess at; it refuses them where it meets them.
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

describe('what a cross-reference may claim', () => {
  // The parse's review: an /Index of [2^53 - 1, 5] in a stream whose rows
  // take no byte. Counted by object number, its row loop never ended,
  // since past 2^53 a number plus one is the same number. Every object
  // number is below /Size, so a subsection past it is refused before a row
  // is read, in a stream and, once its trailer is read, in a table.
  test('a subsection that names an object at or past /Size is refused', () => {
    expectRefused(claimingXrefStream('6', [0, 0, 0], '9007199254740991 5'), 'malformed', 'xref-size')
    expectRefused(claimingXrefStream('6', [1, 4, 2], '0 4 4 3'), 'malformed', 'xref-size')
    parsed(claimingXrefStream('6', [1, 4, 2], '0 6'))
    const w = new PdfWriter()
    basic(w)
    const lines = [1, 2, 3, 4].map((num) => `${String(w.offsets.get(num)).padStart(10, '0')} 00000 n \n`).join('')
    const past = (trailer: string): Uint8Array => {
      const v = new PdfWriter()
      basic(v)
      return v.end(v.raw(`xref\n0 5\n0000000000 65535 f \n${lines}7 1\n0000000000 00000 n \ntrailer\n<<${trailer}/Root 1 0 R>>\n`))
    }
    expectRefused(past('/Size 5'), 'malformed', 'xref-size')
    parsed(past('/Size 8'))
    // ISO 32000 requires a trailer's /Size; without one, nothing holds its subsections.
    expectRefused(past(''), 'malformed', 'xref-size')
  })

  // The parse's review: every section the loop meets is read and kept,
  // chained or not, and a stream's rows of /W [0 0 0] take no byte, so
  // twenty such streams of a hundred thousand rows held 187 MiB, and fifty
  // tables of four-byte entries 436 MiB in 2.1 s, each file within every
  // other bound. Every section's entries are counted together before its
  // rows are read.
  test('entries past MAX_DOCUMENT_XREF_ENTRIES across every section, chained or not, are refused before they are read', () => {
    // The file's own table lists seven entries, the unchained streams the rest.
    parsed(unchainedStreams([100_000, MAX_DOCUMENT_XREF_ENTRIES - 100_000 - 7]))
    expectRefused(unchainedStreams([100_000, MAX_DOCUMENT_XREF_ENTRIES - 100_000 - 6]), 'too-many-objects', 'xref-claim')
    // The file's own table lists five entries, the unchained tables the rest.
    parsed(unchainedTables([100_000, MAX_DOCUMENT_XREF_ENTRIES - 100_000 - 5]))
    expectRefused(unchainedTables([100_000, MAX_DOCUMENT_XREF_ENTRIES - 100_000 - 4]), 'too-many-objects', 'xref-claim')
  })
})

describe('how many cross-reference sections a file may hold', () => {
  // The parse's re-review: a section that claims no entry costs nothing
  // against the entries bound, and is read and kept like any other; a file
  // of twenty megabytes of `xref trailer<</Size 0>>`, nothing chaining it,
  // held 427 MiB and ran a 384 MiB heap out. Sections are counted as they
  // are met, before one is read.
  test('more sections than MAX_DOCUMENT_XREF_SECTIONS are refused as they are met, and as many are read', () => {
    // The file's own section is one of them.
    expect(parsed(emptySections(MAX_DOCUMENT_XREF_SECTIONS - 1)).pages).toEqual([3])
    expectRefused(emptySections(MAX_DOCUMENT_XREF_SECTIONS), 'too-many-objects', 'xref-sections')
  })
})

describe('an object stream holds its members one after another', () => {
  // The parse's review: forty members of an object stream at one offset,
  // before 30 MiB of white space, took 2.1 s, and a thousand of them 107 s,
  // every member read over the same bytes. ISO 32000-1 7.5.7 has the
  // offsets increase; each member's read must end where the next begins,
  // so that each byte of an object stream is read once.
  test('members that share an offset, go back, or run into the next are refused', () => {
    expectRefused(
      membered(
        [
          [7, 0],
          [8, 0],
        ],
        '1',
      ),
      'malformed',
      'object-stream-order',
    )
    expectRefused(
      membered(
        [
          [7, 2],
          [8, 0],
        ],
        '1 2',
      ),
      'malformed',
      'object-stream-order',
    )
    expectRefused(
      membered(
        [
          [7, 0],
          [8, 2],
        ],
        '[1 2 3]',
      ),
      'malformed',
      'object-stream-order',
    )
    expectRefused(
      membered(
        [
          [7, 0],
          [8, 2],
        ],
        '1 2',
        3,
      ),
      'malformed',
      'object-stream-order',
    )
    const forty = Array.from({ length: 40 }, (_, i) => [7 + i, 0] as const)
    expectRefused(membered(forty, concat([repeated(' ', MIB), latin1('null')])), 'malformed', 'object-stream-order')
  })

  // A number's read looks past it for a generation and an R, and a
  // dictionary's for `stream`, and each comes back to where its last token
  // ended: a member ends there, so one whose offset is the white space
  // before it is read, as 4e95b8e and viewers read it. A member whose last
  // token runs into the next one's first byte is still refused.
  test('members that each end where the next begins are read, the white space between them either one', () => {
    const at = (pairs: readonly (readonly [number, number])[], body: string): readonly unknown[] => {
      const objects = parsed(membered(pairs, body)).objects
      return pairs.map(([num]) => objects.get(num))
    }
    expect(
      at(
        [
          [7, 0],
          [8, 2],
        ],
        '1 2',
      ),
    ).toEqual([1, 2])
    expect(
      at(
        [
          [7, 0],
          [8, 1],
        ],
        '1 <</A 1>>',
      ),
    ).toEqual([1, { entries: new Map([['A', 1]]) }])
    expect(
      at(
        [
          [7, 0],
          [8, 8],
        ],
        '<</A 1>> <</B 2>>',
      ),
    ).toEqual([{ entries: new Map([['A', 1]]) }, { entries: new Map([['B', 2]]) }])
    expectRefused(
      membered(
        [
          [7, 0],
          [8, 1],
        ],
        '12 3',
      ),
      'malformed',
      'object-stream-order',
    )
  })

  // The parse's review: an update writes object stream 5 again as a
  // dictionary, and the chain still places 7 in 5, through /Prev. A viewer
  // that follows the chain finds no 7 in the 5 it names; the reader read 7
  // from the 5 the update replaced, H11's shadow by way of its container.
  test("a member read from an earlier definition of its object stream than the chain's is refused as xref-disagrees", () => {
    expectRefused(replacedContainer('<</Replaced true>>'), 'xref-disagrees', 'shadow')
    // Written again as an object stream that holds 7 where the chain says, 7 is read from the one the chain names.
    expect(parsed(replacedContainer('/Type/ObjStm/N 1/First 4/Filter/FlateDecode')).objects.get(7)).toEqual({ entries: new Map([['New', true]]) })
  })
})
