import { describe, expect, test } from 'vitest'
import type { Block, ResolvedDocument } from './document.js'
import { expectation, footerPattern } from './fixture.js'

const page = { size: 'A4', orientation: 'portrait', margins: { top: 36, right: 40, bottom: 36, left: 40 } } as const
const text = (value: string): Block => ({ kind: 'paragraph', runs: [{ text: value }] })

describe('footerPattern', () => {
  // The pattern is the footer's own text. Punctuation in it -- brackets, a
  // dot, a slash -- must match itself, not act as pattern syntax that
  // matches something else or fails to compile.
  test('matches the footer literally, each page field as a named number', () => {
    const pattern = footerPattern([{ kind: 'paragraph', runs: [{ text: 'Seite ' }, { field: 'pageNumber' }, { text: ' / ' }, { field: 'pageCount' }, { text: ' (vertraulich.)' }] }])!
    expect(pattern.exec('Seite 2 / 5 (vertraulich.)')?.groups).toEqual({ pageNumber: '2', pageCount: '5' })
    expect(pattern.test('Seite 2 / 5 (vertraulichX)')).toBe(false)
    expect(pattern.test('Seite 2 / 5 vertraulich.')).toBe(false)
  })

  // A footer that prints the page number twice prints the same number twice;
  // a second named group would not even compile.
  test('matches a field printed twice as the same number both times', () => {
    const pattern = footerPattern([{ kind: 'paragraph', runs: [{ field: 'pageNumber' }, { text: ' - ' }, { field: 'pageNumber' }] }])!
    expect(pattern.test('4 - 4')).toBe(true)
    expect(pattern.test('4 - 5')).toBe(false)
  })

  // A footer without page numbers implies no numbering to check, and a
  // pattern made from nothing would match every line.
  test('gives no pattern for a footer without a page field', () => {
    expect(footerPattern([text('Confidential')])).toBeUndefined()
    expect(footerPattern([])).toBeUndefined()
  })
})

describe('expectation', () => {
  const document: ResolvedDocument = {
    info: { title: 'Derived', creationDate: '2026-01-01T00:00:00Z' },
    page,
    pageHeader: [text('Derived report')],
    pageFooter: [text('Confidential'), { kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }] }],
    body: [
      text('Title'),
      {
        kind: 'table',
        id: 'first',
        columns: [
          { width: 'fill', align: 'left' },
          { width: 'fill', align: 'left' },
          { width: 'fill', align: 'right' },
        ],
        header: ['Key', '', 'Amount'],
        rows: [
          { kind: 'groupHeader', cells: ['Region A', '', ''] },
          // An empty cell prints nothing, so it is no cell to read; the next keeps its column.
          { kind: 'detail', cells: ['A-1', ' ', ' 12.50'] },
        ],
        emptyText: 'None',
      },
      {
        kind: 'keepTogether',
        blocks: [
          text('Summary'),
          { kind: 'paragraph', runs: [{ text: 'Printed on page ' }, { field: 'pageNumber' }] },
          { kind: 'table', id: 'second', columns: [{ width: 'fill', align: 'left' }], header: ['Other'], rows: [{ kind: 'total', cells: ['B-total'] }], emptyText: ' Nothing  here ' },
          { kind: 'image', asset: { id: 'seal', mediaType: 'image/png', bytes: new Uint8Array() }, width: 10, height: 20, fit: 'contain' },
        ],
      },
    ],
  }

  // What the document implies is derived from it, nested blocks included, so
  // a fixture never states a row key or a summary line a second time. A
  // table or an image inside a keep-together block counted as absent would
  // let its rows go missing unnoticed, and a summary line that is not a key
  // could print twice.
  test('derives keys, tables, page regions, kept-together lines and images from the document', () => {
    const derived = expectation(document, { maxPagesExpected: 2 })
    expect(derived.keys).toEqual(['Region A', 'A-1', 'Summary', 'B-total'])
    expect(derived.tables).toEqual([
      {
        id: 'first',
        header: ['Key', 'Amount'],
        rows: [
          { kind: 'groupHeader', key: 'Region A', cells: [{ column: 0, text: 'Region A' }] },
          { kind: 'detail', key: 'A-1', cells: [{ column: 0, text: 'A-1' }, { column: 2, text: '12.50' }] },
        ],
        emptyText: '',
      },
      { id: 'second', header: ['Other'], rows: [{ kind: 'total', key: 'B-total', cells: [{ column: 0, text: 'B-total' }] }], emptyText: 'Nothing here' },
    ])
    expect(derived.pageHeaderLines).toEqual(['Derived report'])
    expect(derived.pageFooterLines).toEqual(['Confidential'])
    expect(derived.footerEveryPage?.exec('Page 2')?.groups).toEqual({ pageNumber: '2' })
    // A line with a page field prints differently on every page; it is not a line to find.
    expect(derived.keptTogether).toEqual([['Summary']])
    expect(derived.images).toEqual([{ width: 10, height: 20 }])
    expect(derived).toMatchObject({
      outcome: 'render',
      minPagesExpected: 1,
      maxPagesExpected: 2,
      keptTogetherByRoom: false,
      noOrphanedHeaders: true,
      noEmptyPages: true,
      allTextInsidePrintable: true,
      noOverlaps: true,
      fontsEmbedded: true,
    })
  })

  // A spacer or a rule prints nothing the checks can read, and a page can
  // hold nothing else -- a heading moved off the page a spacer fills. Checked
  // for empty pages there, a correct PDF would fail; so a document with
  // either is not, and one with neither is.
  test('expects no empty page unless the body has a spacer or a rule', () => {
    expect(expectation(document, { maxPagesExpected: 2 }).noEmptyPages).toBe(true)
    for (const block of [{ kind: 'spacer', height: 10 }, { kind: 'rule', thickness: 0.5 }] as const) {
      expect(expectation({ ...document, body: [...document.body, { kind: 'keepTogether', blocks: [block] }] }, { maxPagesExpected: 2 }).noEmptyPages, block.kind).toBe(false)
    }
  })

  // What a fixture states wins over what is derived: the tall row's keys are
  // its words, not its one row's key.
  test('lets the fixture state what is not derived, or say it otherwise', () => {
    const stated = expectation(document, { maxPagesExpected: 1, keys: ['word0001'], outcome: 'refuse', refusal: { code: 'too-many-pages' } })
    expect(stated).toMatchObject({ keys: ['word0001'], outcome: 'refuse', refusal: { code: 'too-many-pages' } })
  })
})
