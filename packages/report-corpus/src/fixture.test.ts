import { describe, expect, test } from 'vitest'
import type { Block, ResolvedDocument } from './document.js'
import type { ReadPdf } from './read-pdf.js'
import { verify } from './checks.js'
import { chartsOf, drawingsOf, epcCodes, expectation, footerPattern, type Expectation, type Fixture, type Stated } from './fixture.js'
import { hostFonts } from './fixtures/host-fonts.js'

const page = { size: 'A4', orientation: 'portrait', margins: { top: 36, right: 40, bottom: 36, left: 40 } } as const
const text = (value: string): Block => ({ kind: 'paragraph', runs: [{ text: value }] })

describe('footerPattern', () => {
  // The pattern is the footer's own text. Punctuation in it -- brackets, a
  // dot, a slash -- must match itself, not act as pattern syntax that
  // matches something else or fails to compile.
  test('matches the footer literally, each page field as a named number', () => {
    const pattern = footerPattern([
      { kind: 'paragraph', runs: [{ text: 'Seite ' }, { field: 'pageNumber' }, { text: ' / ' }, { field: 'pageCount' }, { text: ' (vertraulich.)' }] },
    ])!
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
          {
            kind: 'table',
            id: 'second',
            columns: [{ width: 'fill', align: 'left' }],
            header: ['Other'],
            rows: [{ kind: 'total', cells: ['B-total'] }],
            emptyText: ' Nothing  here ',
          },
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
          {
            kind: 'detail',
            key: 'A-1',
            cells: [
              { column: 0, text: 'A-1' },
              { column: 2, text: '12.50' },
            ],
          },
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
    expect(derived.images).toEqual([{ kind: 'raster', width: 10, height: 20 }])
    expect(derived.pageRegionImages).toEqual([])
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

  // An SVG is drawn as vectors inside a clip of its box, where a PNG is an
  // image the PDF embeds (0030): expected as an image, a logo drawn as
  // vectors would be missing from every PDF, and one drawn as a picture of
  // itself would pass. A page region's image is drawn on every page, so it
  // is expected there and not once in the body.
  test("tells an SVG image from a PNG, and the page regions' images from the body's", () => {
    const image = (id: string, mediaType: 'image/png' | 'image/svg+xml', width: number): Block => ({
      kind: 'image',
      asset: { id, mediaType, bytes: new Uint8Array() },
      width,
      height: 20,
      fit: 'contain',
    })
    const regions = {
      ...document,
      pageHeader: [{ kind: 'keepTogether', blocks: [image('mark', 'image/svg+xml', 30)] }],
      pageFooter: [image('seal', 'image/png', 40)],
      body: [image('logo', 'image/svg+xml', 50)],
    } as const
    const derived = expectation(regions, { maxPagesExpected: 2 })
    expect(derived.images).toEqual([{ kind: 'vector', width: 50, height: 20 }])
    expect(derived.pageRegionImages).toEqual([
      { kind: 'vector', width: 30, height: 20 },
      { kind: 'raster', width: 40, height: 20 },
    ])
  })

  // A spacer or a rule prints nothing the checks can read, and a page can
  // hold nothing else -- a heading moved off the page a spacer fills. Checked
  // for empty pages there, a correct PDF would fail; so a document with
  // either is not, and one with neither is.
  test('expects no empty page unless the body has a spacer or a rule', () => {
    expect(expectation(document, { maxPagesExpected: 2 }).noEmptyPages).toBe(true)
    for (const block of [
      { kind: 'spacer', height: 10 },
      { kind: 'rule', thickness: 0.5 },
    ] as const) {
      expect(
        expectation({ ...document, body: [...document.body, { kind: 'keepTogether', blocks: [block] }] }, { maxPagesExpected: 2 }).noEmptyPages,
        block.kind,
      ).toBe(false)
    }
  })

  // What a fixture states wins over what is derived: the tall row's keys are
  // its words, not its one row's key.
  test('lets the fixture state what is not derived, or say it otherwise', () => {
    const stated = expectation(document, { maxPagesExpected: 1, keys: ['word0001'], outcome: 'refuse', refusal: { code: 'too-many-pages' } })
    expect(stated).toMatchObject({ keys: ['word0001'], outcome: 'refuse', refusal: { code: 'too-many-pages' } })
  })
})

describe('epcCodes', () => {
  const code = (id: string): Block => ({ kind: 'epcQrCode', id, payload: `BCD ${id}`, size: 85.04 })

  // A code stands where its author put it: beside the payment details in a
  // column, framed in a section, kept with its heading. A walk that missed
  // a container would find no code in an invoice that prints one, and a
  // test of its payload would pass over nothing.
  test('finds every EPC code, inside columns, sections and keep-together blocks, in document order', () => {
    const blocks: Block[] = [
      code('first'),
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [text('details')] },
          { width: 85.04, blocks: [code('in-column')] },
        ],
      },
      { kind: 'section', blocks: [{ kind: 'keepTogether', blocks: [text('heading'), code('kept-in-section')] }] },
      text('after'),
    ]
    expect(epcCodes(blocks).map((block) => block.id)).toEqual(['first', 'in-column', 'kept-in-section'])
    expect(epcCodes([text('none')])).toEqual([])
  })
})

describe('drawingsOf', () => {
  const image = (mediaType: 'image/png' | 'image/svg+xml', width: number): Block => ({
    kind: 'image',
    asset: { id: `image-${width}`, mediaType, bytes: new Uint8Array() },
    width,
    height: width,
    fit: 'contain',
  })
  const chart = (id: string, empty?: string): Block => ({
    kind: 'chart',
    chart: 'line',
    id,
    width: 200,
    height: 100,
    legend: [],
    categories: [],
    series: [],
    ticks: [],
    valueLabels: false,
    ...(empty === undefined ? {} : { empty }),
  })

  // An SVG image and a chart are each found by a clip of their box, in one
  // walk in document order (`drawings.ts`): a walk that missed a container
  // would seek a chart in a column after the image below it and take its
  // clip, and one that listed a PNG, or a chart with nothing to draw, would
  // seek a clip none of them has.
  test('lists SVG images and charts that draw something, inside columns, sections and keep-together blocks, in document order', () => {
    const blocks: Block[] = [
      image('image/svg+xml', 10),
      image('image/png', 20),
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [chart('in-column')] },
          { width: 'fill', blocks: [image('image/svg+xml', 30)] },
        ],
      },
      { kind: 'section', blocks: [{ kind: 'keepTogether', blocks: [text('heading'), chart('kept-in-section'), chart('nothing', 'No data')] }] },
    ]
    expect(drawingsOf(blocks)).toEqual([
      { kind: 'image', width: 10, height: 10 },
      { kind: 'chart', id: 'in-column', width: 200, height: 100 },
      { kind: 'image', width: 30, height: 30 },
      { kind: 'chart', id: 'kept-in-section', width: 200, height: 100 },
    ])
  })
})

describe('chartsOf', () => {
  const value = (exact: string, text = exact) => ({ exact, text })
  const documentOf = (body: readonly Block[], fonts?: ResolvedDocument['fonts']): ResolvedDocument => ({
    info: { title: 'Charts', creationDate: '2026-01-01T00:00:00Z' },
    page,
    pageHeader: [],
    pageFooter: [],
    body,
    ...(fonts === undefined ? {} : { fonts }),
  })
  const bars: Block = {
    kind: 'chart',
    chart: 'bar',
    id: 'sales',
    width: 300,
    height: 200,
    title: ' Sales ',
    categoryTitle: 'Region',
    valueTitle: ' ',
    categories: ['North', ' ', 'A  B'],
    series: [
      { color: '#1f77b4', values: [value('10.25', '10.25'), null, value('0', '0')] },
      { color: '#ff7f0e', values: [value('-5', '−5'), value('15'), null] },
    ],
    ticks: ['-5', '0', '5', '10', '15'].map((exact) => value(exact)),
    valueLabels: true,
    legend: [
      { text: 'Plan', color: '#1f77b4' },
      { text: '', color: '#ff7f0e' },
    ],
  }
  const pie: Block = {
    kind: 'chart',
    chart: 'pie',
    id: 'shares',
    width: 200,
    height: 200,
    slices: [
      { color: '#1f77b4', value: value('3') },
      { color: '#ff7f0e', value: value('0') },
    ],
    legend: [
      { text: 'North: 3 (100.0 %)', color: '#1f77b4' },
      { text: 'East: 0 (0.0 %)', color: '#ff7f0e' },
    ],
  }
  const drawn = (id: string): Block => ({ ...bars, id, title: id })
  const empty = (id: string): Block => ({
    kind: 'chart',
    chart: 'line',
    id,
    width: 200,
    height: 100,
    title: 'Balance',
    empty: 'No data',
    legend: [],
    categories: [],
    series: [],
    ticks: [],
    valueLabels: false,
  })

  // A chart's words are the runtime's, and the check holds the PDF to them
  // as PDF.js extracts them: a title with a space at either end, or two
  // spaces in a category, expected as written would be missing from a
  // PDF that prints it. A word that prints nothing -- a blank axis title,
  // a blank category, an empty legend entry -- is none to find, and its
  // slot stays; a pie's labels print in its legend alone, so it has no
  // category or tick to find. A value prints only where the chart labels
  // values, as its text; it is placed by its exact value.
  test("derives each chart's words, categories, ticks and marks from its block", () => {
    const [sales, shares] = chartsOf(documentOf([bars, pie]))
    expect(sales).toEqual({
      id: 'sales',
      chart: 'bar',
      width: 300,
      height: 200,
      words: ['Sales', 'Region', 'North', 'A B', '10.25', '0', '−5', '15', 'Plan'],
      categories: ['North', '', 'A B'],
      ticks: ['-5', '0', '5', '10', '15'].map((exact) => value(exact)),
      marks: [
        { paint: '#1f77b4', values: ['10.25', null, '0'] },
        { paint: '#ff7f0e', values: ['-5', '15', null] },
      ],
      faces: [],
      empty: false,
    })
    expect(shares).toEqual({
      id: 'shares',
      chart: 'pie',
      width: 200,
      height: 200,
      words: ['North: 3 (100.0 %)', 'East: 0 (0.0 %)'],
      categories: [],
      ticks: [],
      marks: [
        { paint: '#1f77b4', values: ['3'] },
        { paint: '#ff7f0e', values: ['0'] },
      ],
      faces: [],
      empty: false,
    })
    expect(chartsOf(documentOf([{ ...bars, valueLabels: false }]))[0]!.words).toEqual(['Sales', 'Region', 'North', 'A B', 'Plan'])
    expect(chartsOf(documentOf([empty('nothing')]))[0]).toMatchObject({ words: ['Balance', 'No data'], categories: [], ticks: [], marks: [], empty: true })
  })

  // A chart prints in its style's token, its title bold in it (0058): where
  // the token maps a host font, each word, its ticks' labels among them,
  // is held to the face it prints in, so that a chart printed in Roboto,
  // or its title in the regular face, is seen. A token the report maps no
  // host font for prints in Roboto, and is held to no face.
  test('holds each word to the face it prints in where its token maps a host font', () => {
    const fonts = hostFonts.document.fonts
    const [serif] = chartsOf(documentOf([{ ...bars, style: { font: 'serif' } }], fonts))
    expect(serif!.faces).toEqual([
      { text: 'Sales', postScriptName: 'LiberationSerif-Bold' },
      ...['Region', 'North', 'A B', '10.25', '0', '−5', '15', 'Plan', '-5', '0', '5', '10', '15'].map((text) => ({ text, postScriptName: 'LiberationSerif' })),
    ])
    const [italic] = chartsOf(documentOf([{ ...pie, title: 'Shares', style: { font: 'serif', italic: true } }], fonts))
    expect(italic!.faces).toEqual([
      { text: 'Shares', postScriptName: 'LiberationSerif-BoldItalic' },
      { text: 'North: 3 (100.0 %)', postScriptName: 'LiberationSerif-Italic' },
      { text: 'East: 0 (0.0 %)', postScriptName: 'LiberationSerif-Italic' },
    ])
    expect(chartsOf(documentOf([bars], fonts))[0]!.faces).toEqual([])
  })

  // A chart with nothing to draw has no box to be found by: its words are
  // sought after the chart drawn before it in its flow, else after the
  // page breaks before it (`check-charts.ts`). Anchored wrongly they are
  // sought from the first page, where the same words printed as other
  // text pass for them, or after a chart beside it in another column,
  // which may stand lower, where a correct PDF fails. A section or a
  // keep-together block flows in its flow, a column below what stands
  // before its columns, and what follows a columns block below all of
  // them.
  test('anchors an empty chart after the chart drawn before it in its flow, else after the page breaks before it', () => {
    const body: Block[] = [
      { kind: 'pageBreak' },
      { kind: 'section', blocks: [{ kind: 'keepTogether', blocks: [empty('framed')] }] },
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [empty('beside')] },
          { width: 'fill', blocks: [drawn('right'), empty('under-right')] },
        ],
      },
      empty('below-columns'),
      { kind: 'section', blocks: [drawn('last')] },
      { kind: 'pageBreak' },
      { kind: 'section', blocks: [empty('after-break')] },
      { kind: 'columns', columns: [{ width: 'fill', blocks: [empty('in-column')] }] },
    ]
    expect(chartsOf(documentOf(body)).map(({ id, after, breaks }) => ({ id, after, breaks }))).toEqual([
      { id: 'framed', after: undefined, breaks: 1 },
      { id: 'beside', after: undefined, breaks: 1 },
      { id: 'right', after: undefined, breaks: undefined },
      { id: 'under-right', after: 'right', breaks: undefined },
      { id: 'below-columns', after: 'right', breaks: undefined },
      { id: 'last', after: undefined, breaks: undefined },
      { id: 'after-break', after: 'last', breaks: undefined },
      { id: 'in-column', after: 'last', breaks: undefined },
    ])
    expect(chartsOf(documentOf([empty('first')]))[0]).toMatchObject({ breaks: 0 })
  })

  // The drawings an expectation seeks and the charts it proves are derived
  // together, and never stated: a fixture that stated its drawings away
  // sought no drawing for its chart, and a chart drawn with no bar passed
  // every check (N3). What is stated of either is the derived list again;
  // and an expectation built by hand whose two lists name other charts,
  // in order, is refused by `verify` as the expectation's mistake, before
  // a page is read.
  test('derives its drawings and its charts whatever is stated, and verify refuses two that disagree', () => {
    const document = documentOf([bars, empty('nothing'), pie])
    const derived = expectation(document, { maxPagesExpected: 1 })
    const stated = { maxPagesExpected: 1, drawings: [], charts: [] } as unknown as Stated
    expect(expectation(document, stated)).toEqual(derived)
    const fixture = (expect: Expectation): Fixture => ({ id: 'charts', title: 'Charts', document, maxPages: 1, expect })
    const pdf: ReadPdf = { pages: [], fonts: [], attachments: [] }
    expect(() => verify(fixture({ ...derived, drawings: [] }), pdf)).toThrow(
      'the expectation of charts seeks the charts none and proves the charts sales, shares that draw something: the two are derived together, in document order (`drawingsOf`, `chartsOf`)',
    )
    expect(() => verify(fixture({ ...derived, charts: derived.charts.slice(0, 1) }), pdf)).toThrow(
      'the expectation of charts seeks the charts sales, shares and proves the charts sales that draw something',
    )
    expect(() => verify(fixture({ ...derived, drawings: [...derived.drawings].reverse() }), pdf)).toThrow('seeks the charts shares, sales and proves')
  })

  // The expectation proves every chart it holds, and the drawings it seeks
  // are those charts' that draw something, in the same order.
  test('is the expectation’s charts, the drawn ones among its drawings', () => {
    const document = documentOf([empty('nothing'), bars, { kind: 'columns', columns: [{ width: 'fill', blocks: [pie] }] }])
    const derived = expectation(document, { maxPagesExpected: 1 })
    expect(derived.charts).toEqual(chartsOf(document))
    expect(derived.drawings).toEqual([
      { kind: 'chart', id: 'sales', width: 300, height: 200 },
      { kind: 'chart', id: 'shares', width: 200, height: 200 },
    ])
  })
})
