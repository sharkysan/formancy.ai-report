import { readZip, type Docx, type DocxBlock } from '@formancy/report-corpus'
import type { Block, ResolvedDocument } from '@formancy/report-runtime'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { renderDocx } from './render.js'
import { documentOf, paragraph, refusalOf, written } from './testing/support.js'
import { attribute, element, own, text, xmlCharacter } from './xml.js'

/**
 * Every string a document carries is somebody else's, and a Word file is
 * XML (0068): a string that is not escaped is markup, a field Word runs,
 * or a relationship to an address Word fetches. These hold each string,
 * wherever a document holds one, to being read back from the file as
 * that very text, by a parser that is not the writer, in a file that
 * holds nothing more for it.
 */

/** Every paragraph's text runs, through every table's cells, in order. */
function runsOf(blocks: readonly DocxBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.kind === 'paragraph'
      ? block.runs.flatMap((run) => (run.kind === 'text' ? [run.text] : []))
      : block.rows.flatMap((row) => row.cells.flatMap((cell) => runsOf(cell.blocks))),
  )
}

/** Every string a file prints or states of its document's: the title, and each run of each region. */
const stringsOf = (docx: Docx): string[] => [
  docx.title ?? '',
  ...[docx.body, docx.header?.blocks ?? [], docx.firstHeader?.blocks ?? [], docx.footer?.blocks ?? []].flatMap(runsOf),
]

/** A file's shape without its words: its parts, each part's relationships, and what each region holds, element for element. */
function shapeOf(docx: Docx): unknown {
  const blocks = (list: readonly DocxBlock[]): unknown =>
    list.map((block) =>
      block.kind === 'paragraph' ? block.runs.map((run) => run.kind) : block.rows.map((row) => row.cells.map((cell) => [cell.span, blocks(cell.blocks)])),
    )
  const names = [...docx.parts.keys()]
  return {
    parts: names,
    relationships: ['', ...names].map((name) => docx.relationships(name).map(({ id, type, target }) => `${id} ${type} ${target}`)),
    regions: [docx.body, docx.header?.blocks ?? [], docx.firstHeader?.blocks ?? [], docx.footer?.blocks ?? []].map(blocks),
  }
}

/** A document with a string in every place a document holds one that a Word file writes. */
const RICH: ResolvedDocument = documentOf(
  [
    { kind: 'paragraph', runs: [{ text: 'First run' }, { text: 'second run', bold: true }, { text: 'lowered', baseline: 'subscript' }], keepWithNext: true },
    {
      kind: 'table',
      id: 'lines',
      columns: [
        { width: 100, align: 'left' },
        { width: 'fill', align: 'right' },
      ],
      header: ['Key', 'Amount'],
      rows: [
        { kind: 'groupHeader', cells: ['Group'], across: true },
        { kind: 'detail', cells: ['Row', '1.00'] },
        { kind: 'total', cells: ['Total', '1.00'] },
      ],
      emptyText: 'unprinted',
    },
    { kind: 'table', id: 'empty', columns: [{ width: 'fill', align: 'left' }], header: ['Only'], rows: [], emptyText: 'Nothing here' },
    { kind: 'columns', columns: [{ width: 'fill', blocks: [paragraph('In a column')] }] },
    { kind: 'section', padding: 4, blocks: [paragraph('In a frame')] },
    { kind: 'keepTogether', blocks: [paragraph('Kept')] },
  ],
  {
    info: { title: 'The title', creationDate: '2026-10-15T08:00:00Z' },
    pageHeader: [paragraph('Header')],
    firstPageHeader: [paragraph('First header')],
    pageFooter: [{ kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }] }],
  },
)

/** The keys under which a document holds a string that is no text: a name from a closed list, an id, a colour, a date. */
const NOT_TEXT: ReadonlySet<string> = new Set([
  'kind',
  'font',
  'align',
  'fit',
  'size',
  'orientation',
  'mediaType',
  'id',
  'color',
  'fill',
  'stroke',
  'creationDate',
  'field',
  'baseline',
  'width',
])

type Path = readonly (string | number)[]

/** Where `value` holds a string that is text: every string leaf, but those under a key of `NOT_TEXT`. */
function textPaths(value: unknown, path: Path = []): Path[] {
  if (typeof value === 'string') return [path]
  if (Array.isArray(value)) return value.flatMap((each, index) => textPaths(each, [...path, index]))
  if (typeof value !== 'object' || value === null || value instanceof Uint8Array) return []
  return Object.entries(value).flatMap(([key, each]) => (NOT_TEXT.has(key) && typeof each === 'string' ? [] : textPaths(each, [...path, key])))
}

/** `value` with the string at `path` replaced. */
function replaced<T>(value: T, path: Path, by: string): T {
  if (path.length === 0) return by as T
  const [key, ...rest] = path
  if (Array.isArray(value)) return value.map((each: unknown, index) => (index === key ? replaced(each, rest, by) : each)) as T
  return { ...value, [key as string]: replaced((value as Record<string, unknown>)[key as string], rest, by) }
}

const PATHS = textPaths(RICH)

describe('a string a document carries', () => {
  // A walk that found no string, or missed a region, would hold nothing: the places are counted, and each kind named.
  test('is found in every place the document holds one', () => {
    const where = new Set(PATHS.map((path) => path.filter((step) => typeof step === 'string').join('.')))
    expect([...where].sort()).toEqual([
      'body.blocks.runs.text',
      'body.columns.blocks.runs.text',
      'body.emptyText',
      'body.header',
      'body.rows.cells',
      'body.runs.text',
      'firstPageHeader.runs.text',
      'info.title',
      'pageFooter.runs.text',
      'pageHeader.runs.text',
    ])
  })

  /** Markup, a field, a comment, a declaration, an entity, and the quotes and the brackets themselves, between letters and spaces. */
  const hostile = fc
    .array(
      fc.constantFrom(
        '&',
        '<',
        '>',
        '"',
        "'",
        ']]>',
        '</w:t>',
        '</w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> INCLUDETEXT "x" </w:instrText>',
        '<w:br/>',
        ' PAGE ',
        '&amp;',
        '&#60;',
        '&undefined;',
        '<!--',
        '<![CDATA[',
        '<?xml version="1.0"?>',
        '" r:id="rId1',
        'a',
        ' ',
        'é',
      ),
      { minLength: 1, maxLength: 8 },
    )
    .map((pieces) => pieces.join(''))

  // The one property everything else here is a case of: wherever a document holds text, whatever the text, the file reads back as that
  // text and holds no element, field or relationship more than the same document without it. A string field a later version adds to the
  // document is walked with the rest, once the document above holds one.
  // Its 400 files, each written and read back, took 3.1 seconds alone and 5.7 to 6.6 under coverage, which is how CI's test job runs this
  // suite and is past vitest's own 5 seconds: measured on 18 November 2026 on an Intel Core i9-10900K shared with other work, under Node
  // 24.21.0. No CI runner was timed; the bound is ten times what was measured here.
  test('is read back as that very text, in a file that holds nothing more for it', () => {
    const plain = new Map(PATHS.map((path) => [path, JSON.stringify(shapeOf(written(replaced(RICH, path, 'plain'))))]))
    fc.assert(
      fc.property(fc.constantFrom(...PATHS), hostile, (path, value) => {
        // The empty text of a table with detail rows prints nowhere: it is written into no file.
        const printed = path.join('.') !== 'body.1.emptyText'
        const docx = written(replaced(RICH, path, value))
        expect(stringsOf(docx).includes(value)).toBe(printed)
        expect(JSON.stringify(shapeOf(docx))).toBe(plain.get(path))
      }),
      { numRuns: 400 },
    )
  }, 60_000)

  // The cases a person would try first, named, so that a failure says which.
  test.each([
    ['an ampersand and angle brackets', 'R&D <draft> a > b'],
    ['quotes of both kinds', `"double" and 'single'`],
    ['the end of a CDATA section', 'a ]]> b'],
    ['a closing tag of the text element', 'before</w:t></w:r></w:p>after'],
    ['a field written as markup', '<w:fldSimple w:instr=" INCLUDETEXT c:\\\\x.txt "/>'],
    ['an entity and a character reference', '&lt; &#x41; &nosuch;'],
    ['a document type', '<!DOCTYPE w:document [<!ENTITY e SYSTEM "file:///etc/passwd">]>'],
  ])('with %s is that text in a run, a cell, a header cell and the title', (_name, value) => {
    for (const path of [
      ['body', 0, 'runs', 0, 'text'],
      ['body', 1, 'rows', 1, 'cells', 0],
      ['body', 1, 'header', 1],
      ['info', 'title'],
    ] as const) {
      expect(stringsOf(written(replaced(RICH, path, value)))).toContain(value)
    }
  })
})

describe('the white space of a run', () => {
  const read = (value: string): string[] =>
    runsOf(written(documentOf([{ kind: 'paragraph', runs: [{ text: 'Name:' }, { text: value }, { text: 'Value' }] }])).body)

  // The runtime lowers each inline to a run of its own, so 'Name: ' and its value are two runs: a space lost at the end of one prints 'Name:Value'.
  test.each([
    ['a space at its end', 'between '],
    ['a space at its start', ' between'],
    ['two spaces together', 'a  b'],
    ['nothing but a space', ' '],
    ['nothing but spaces', '   '],
    ['a no-break space at its end', 'a\u00a0'],
  ])('with %s is kept', (_name, value) => {
    expect(read(value)).toEqual(['Name:', value, 'Value'])
  })

  // Word strips the spaces at either end of a text element that does not say they are kept; a parser that is not Word keeps them
  // either way, so the file is read by a reader that refuses one without it (`read.ts`), and held here to saying so for every one.
  test('is said to be kept, on every text element and every field instruction of a file', () => {
    const bytes = renderDocx(RICH)
    const parts = readZip(bytes).filter((entry) => entry.name.startsWith('word/') && entry.name.endsWith('.xml'))
    const xml = parts.map((entry) => new TextDecoder().decode(entry.bytes)).join('')
    expect(xml.match(/<w:(t|instrText)[ >/]/g)?.length).toBeGreaterThan(10)
    expect(xml.match(/<w:(t|instrText)(?=[ >/])(?! xml:space="preserve">)/g)).toBeNull()
  })

  // A run that prints nothing is no run: an empty element would be one more thing for a reader to trip on.
  test('of no text at all is no run of the file', () => {
    expect(read('')).toEqual(['Name:', 'Value'])
  })
})

describe('a line ending', () => {
  /** The runs a paragraph of `runs` is read back as, a break a line feed. */
  const lines = (...runs: readonly string[]): string[] => runsOf(written(documentOf([{ kind: 'paragraph', runs: runs.map((text) => ({ text })) }])).body)
  /** The runs a table's one detail cell is read back as, after its header's. */
  const cell = (value: string): string[] => {
    const table: Block = {
      kind: 'table',
      id: 'lines',
      columns: [{ width: 'fill', align: 'left' }],
      header: ['Key'],
      rows: [{ kind: 'detail', cells: [value] }],
      emptyText: '',
    }
    return runsOf(written(documentOf([table])).body).slice(1)
  }

  // The PDF's engine ends a line at a line feed, at a carriage return, and once at the two together: each is one break in Word, not two and not a space.
  test.each([
    ['a line feed', 'one\ntwo', 'one\ntwo'],
    ['a carriage return', 'one\rtwo', 'one\ntwo'],
    ['the two together', 'one\r\ntwo', 'one\ntwo'],
    ['two line feeds', 'one\n\ntwo', 'one\n\ntwo'],
    ['a line feed at its start', '\none', '\none'],
  ])('%s inside a run is a break of the line', (_name, value, read) => {
    expect(lines(value)).toEqual([read])
  })

  // A cell's text is written by another path than a paragraph's run: the same endings, in a cell of a table, read back from that cell.
  test.each([
    ['a line feed', 'one\ntwo', 'one\ntwo'],
    ['a carriage return and a line feed', 'one\r\ntwo', 'one\ntwo'],
    ['two line feeds', 'one\n\ntwo', 'one\n\ntwo'],
  ])('%s inside a cell is a break of the line', (_name, value, read) => {
    expect(cell(value)).toEqual([read])
  })

  // The PDF's engine ends its last line at the ending that ends a text and opens no line after it (`against-pdf.test.ts` counts the lines):
  // a break written for it would be a line more in Word than the PDF prints, under every note and address that ends in a line feed.
  test.each([
    ['a line feed', 'one\n', 'one'],
    ['a carriage return', 'one\r', 'one'],
    ['the two together', 'one\r\n', 'one'],
    ['two line feeds, the first of which is a line the PDF prints', 'one\n\n', 'one\n'],
  ])('%s that ends a paragraph or a cell is no break', (_name, value, read) => {
    expect(lines(value)).toEqual([read])
    expect(cell(value)).toEqual([read])
  })

  // The ending that ends a paragraph is its last run's, as the document holds its runs: any run after a line ending is a line the PDF opens,
  // a run of nothing among them -- which this writer took for no run at all, and so for no line, until the lines were counted on the PDF.
  test.each<[string, string[], string[]]>([
    ['its last run ends', ['one', 'two\n'], ['one', 'two']],
    ['its last run is, alone', ['one', '\n'], ['one']],
    ['an earlier run ends, which is a line', ['one\n', 'two'], ['one\n', 'two']],
    ['a run of nothing follows the ending, which is a line', ['one\n', ''], ['one\n']],
    ['two runs end, the first of which is a line', ['one\n', '\n'], ['one\n']],
  ])('where %s, the paragraph ends as the PDF ends it', (_name, runs, read) => {
    expect(lines(...runs)).toEqual(read)
  })

  // A paragraph or a cell of a line ending alone prints one empty line in the PDF, as one of nothing does: no run, and no break.
  test('alone is a paragraph and a cell of no run', () => {
    expect(lines('\n')).toEqual([])
    expect(cell('\r\n')).toEqual([])
  })
})

describe('a character a Word file does not print', () => {
  // A control character is no text to Word, and most are no XML; the separators break a line in Word where the PDF breaks none;
  // half a surrogate pair and the two noncharacters are no XML at all. Each is refused, naming the block and the code point, never written as a box or a space.
  test.each([
    ['U+0000', '\u0000', /U\+0000/],
    ['a tab', '\t', /U\+0009, a control character/],
    ['U+001F', '\u001f', /U\+001F, a control character/],
    ['U+007F', '\u007f', /U\+007F, a control character/],
    ['U+0085', '\u0085', /U\+0085, a control character/],
    ['U+009F', '\u009f', /U\+009F, a control character/],
    ['a line separator', '\u2028', /U\+2028, a line or paragraph separator/],
    ['a paragraph separator', '\u2029', /U\+2029, a line or paragraph separator/],
    ['half a surrogate pair', 'a\ud83db', /U\+D83D/],
    ['the other half', 'a\ude00b', /U\+DE00/],
    ['U+FFFE', '\ufffe', /U\+FFFE/],
    ['U+FFFF', '\uffff', /U\+FFFF/],
    ['a script a report does not print', '報告', /U\+5831, which is in no script a report prints/],
    ['a bidirectional control', 'a\u202eb', /U\+202E, a bidirectional control/],
  ])('%s is refused in a run and in a cell, naming where', (_name, value, sentence) => {
    expect(refusalOf(documentOf([paragraph('fine'), paragraph(`before${value}after`)]))).toMatchObject({ code: 'unsupported', subject: 'body[1]' })
    expect(refusalOf(documentOf([paragraph(`before${value}after`)])).message).toMatch(sentence)
    const table: Block = {
      kind: 'table',
      id: 'lines',
      columns: [{ width: 'fill', align: 'left' }],
      header: ['Key'],
      rows: [{ kind: 'detail', cells: [value] }],
      emptyText: '',
    }
    expect(refusalOf(documentOf([table]))).toMatchObject({ code: 'unsupported', subject: 'lines' })
  })

  // The refusal names the code point and never the text around it: a customer's words are not an error message's.
  test('is named by its code point, and the text around it is not quoted', () => {
    expect(refusalOf(documentOf([paragraph('a secret\u0001value')])).message).not.toMatch(/secret|value/)
  })
})

describe('the title and the creation date', () => {
  // The title is written into the file's properties and printed in no face: report-spec admits one in any script, and the PDF holds it to being text alone.
  test.each([
    ['in a script a report does not print', '報告書 2026'],
    ['with a tab, a line feed and a carriage return', 'a\tb\nc\rd'],
    ['with a control character XML holds', 'a\u0085b'],
  ])('a title %s is written as it is', (_name, title) => {
    expect(written(documentOf([], { info: { title, creationDate: '2026-01-01T00:00:00Z' } })).title).toBe(title)
  })

  // What no XML document holds cannot be a title either.
  test.each([
    ['a control character', 'a\u0001b'],
    ['half a surrogate pair', 'a\ud800'],
    ['a noncharacter', 'a\uffff'],
  ])('a title with %s is refused, naming the title', (_name, title) => {
    expect(refusalOf(documentOf([], { info: { title, creationDate: '2026-01-01T00:00:00Z' } }))).toMatchObject({ code: 'unsupported', subject: 'info.title' })
  })

  // The date is parsed and written by the writer, never copied: the document's string could be any text, and a date in another zone is the same instant.
  test.each([
    ['2026-10-15T10:00:00+02:00', '2026-10-15T08:00:00Z'],
    ['2026-10-15T08:00:00.999Z', '2026-10-15T08:00:00Z'],
    ['2026-10-15T08:00Z', '2026-10-15T08:00:00Z'],
    ['2026-10-15', '2026-10-15T00:00:00Z'],
    // The days and the years at the edge of what is refused below: a leap day, the last second of a day, and the first and the last year.
    ['2028-02-29', '2028-02-29T00:00:00Z'],
    ['2026-11-17T23:59:59-12:00', '2026-11-18T11:59:59Z'],
    ['+002026-10-15T08:00:00Z', '2026-10-15T08:00:00Z'],
    ['0001-01-01', '0001-01-01T00:00:00Z'],
    ['9999-12-31T23:59:59Z', '9999-12-31T23:59:59Z'],
  ])('the creation date %s is written as the instant it is, in UTC', (creationDate, created) => {
    expect(written(documentOf([], { info: { title: 'T', creationDate } })).created).toBe(created)
  })

  // The platform reads on past the calendar: 30 February as 2 March, and an hour 24 as the first of the next day. The writer writes the
  // instant, so each of these was written as a date the document does not state, with nothing said: 2026-02-30 as 2026-03-02.
  test.each([
    ['a day its month has not', '2026-02-30'],
    ['a leap day in a year that has none', '2026-02-29T08:00:00Z'],
    ['a thirty-first of a month of thirty days', '2026-04-31T10:00:00+02:00'],
    ['an hour past the last of its day', '2026-11-17T24:00:00Z'],
  ])('a creation date of %s is refused, naming it, and never written as the date after it', (_name, creationDate) => {
    const refusal = refusalOf(documentOf([], { info: { title: 'T', creationDate } }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'info.creationDate' })
    expect(refusal.message).toMatch(/states a day or a time no calendar has/)
  })

  // A zone is hours and minutes from UTC, under a day and under an hour: the platform reads no date of one past either, and neither is written.
  test.each(['2026-11-17T12:00:00+24:00', '2026-11-17T12:00:00+02:60'])('the creation date %s is refused for a zone that is none', (creationDate) => {
    expect(refusalOf(documentOf([], { info: { title: 'T', creationDate } }))).toMatchObject({ code: 'unsupported', subject: 'info.creationDate' })
  })

  // A core property's date is XML Schema's, which has no year 0000: written, it is a date a reader of the schema refuses. The last is of
  // the year 1 where it is stated and of the year before in UTC, which is what is written.
  test.each(['0000-01-01', '0000-06-01T00:00:00Z', '0001-01-01T00:00:00+01:00'])('the creation date %s is refused for its year', (creationDate) => {
    const refusal = refusalOf(documentOf([], { info: { title: 'T', creationDate } }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'info.creationDate' })
    expect(refusal.message).toMatch(/a year a Word file cannot state/)
  })

  // A date and time that states no zone is read in the machine's: the one document was three files in three zones, by their digests, before
  // this was refused (Pacific/Kiritimati, America/Los_Angeles and UTC, a process each). So is a date no ISO form states, which the
  // platform reads in a way of its own. The runtime writes an instant with its zone; only a document made otherwise states none.
  test.each([
    ['a date and time with no zone', '2026-11-17T12:00:00'],
    ['a date and time to the minute with no zone', '2026-11-17T12:00'],
    ['a date written out', '17 November 2026 12:00'],
    ['a date and time with a space between them', '2026-11-17 12:00:00Z'],
  ])('%s is refused as a creation date, naming it', (_name, creationDate) => {
    const refusal = refusalOf(documentOf([], { info: { title: 'T', creationDate } }))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: 'info.creationDate' })
    expect(refusal.message).toMatch(/states no instant: a Word file is dated by an ISO 8601 date and time with its zone/)
  })
})

describe('the escapers', () => {
  // Each is whole by itself: whatever string reaches one is written so that a parser reads that string back, or it throws.
  test('write text with its markup escaped, and a carriage return as its reference', () => {
    expect(text('a & b < c > d ]]> "e" \r\n')).toBe('a &amp; b &lt; c &gt; d ]]&gt; "e" &#13;\n')
  })

  // An attribute's value is normalised by a parser: a tab or a line ending left as it is would be read back as a space.
  test('write an attribute with its quote and its white space escaped', () => {
    expect(attribute('a "b" & <c>\t\n\r')).toBe('a &quot;b&quot; &amp; &lt;c&gt;&#9;&#10;&#13;')
  })

  // A character no XML document holds cannot be escaped into one: reaching the escaper is a defect of the checks, and is thrown, never written.
  test.each(['\u0000', '\u0008', '\ud800', '\uffff'])('throw at a character XML does not hold (%j)', (value) => {
    expect(() => text(value)).toThrow(/no XML document holds/)
    expect(() => attribute(value)).toThrow(/no XML document holds/)
  })

  // The one list both escapers and the checks read: a character it took for XML's would be written into a file no parser opens.
  test("know XML 1.0's characters", () => {
    expect([0x9, 0xa, 0xd, 0x20, 0x85, 0xd7ff, 0xe000, 0xfffd, 0x10000, 0x10ffff].every(xmlCharacter)).toBe(true)
    expect([0x0, 0x8, 0xb, 0x1f, 0xd800, 0xdfff, 0xfffe, 0xffff].some(xmlCharacter)).toBe(false)
  })

  // A string from a document does not compile where markup stands; what does compile is held here to what it writes.
  test('build an element from markup alone, closed where it is empty', () => {
    expect(
      element(
        'w:p',
        [
          ['w:val', own('single')],
          ['w:sz', 4],
        ],
        [element('w:b')],
      ),
    ).toBe('<w:p w:val="single" w:sz="4"><w:b/></w:p>')
    // A string as a document carries one: its type is `string`, whatever it holds.
    const carried = String('<w:t>')
    // @ts-expect-error -- a string is no markup: it is escaped by `text` or `attribute`, or it is not written.
    element('w:t', [], [carried])
    // @ts-expect-error -- a name is a literal with one of the writer's prefixes, never a value.
    element(carried)
    // @ts-expect-error -- `own` admits a literal the writer typed, never a string a document could hold.
    expect(() => own(carried)).toThrow(/a character to escape/)
    expect(() => element('w:sz', [['w:val', 1.5]])).toThrow(/no whole number/)
  })
})
