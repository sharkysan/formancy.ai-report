import { deflateSync } from 'node:zlib'
import type { Block, Image, ResolvedDocument, Table } from '../document.js'
import { IMAGE_KINDS } from '../image-kinds.js'
import { documentOf, paragraph } from './build.js'
import { pngOf } from './png.js'
import { SVG_AS_SAVED } from './svg.js'

/**
 * Documents no engine prints (0068): each a document on the corpus page
 * that breaks its contract with an engine in one way -- a block where
 * none may stand, a width, a size, a colour, a field or a row the
 * document's types do not hold, bytes that are no picture, a PNG whose
 * image data is no whole zlib stream of its scanlines -- and that an
 * engine can refuse from the document alone, before it measures anything.
 *
 * What an engine must refuse of a document is stated in each engine,
 * report-render-pdf's `check.ts` and report-render-docx's, since no
 * package below both holds it. This list is what holds the two
 * statements together: each engine's tests refuse every one of these, and
 * report-render-docx's `against-pdf.test.ts` holds both to the same code
 * and the same subject for each. A refusal an engine makes of what it
 * measured, or of what only it draws, is not here.
 */
export interface Malformed {
  /** Stable, kebab-case. */
  readonly id: string
  /** What is wrong with it, as a person would say it. */
  readonly title: string
  readonly document: ResolvedDocument
}

const PNG = IMAGE_KINDS[0]!
const image = (more: Partial<Image> = {}): Image => ({ kind: 'image', asset: PNG, width: 32, height: 32, fit: 'contain', ...more })
const table = (more: Partial<Table> = {}): Table => ({
  kind: 'table',
  id: 'lines',
  columns: [
    { width: 100, align: 'left' },
    { width: 'fill', align: 'right' },
  ],
  header: ['Key', 'Amount'],
  rows: [{ kind: 'detail', cells: ['ROW-1', '1.00'] }],
  emptyText: 'No records',
  ...more,
})
/** A value the document's types do not hold, as a document made by hand, or by a later runtime, may carry it. */
const untyped = <T>(value: unknown): T => value as T
const body = (id: string, title: string, ...blocks: readonly Block[]): Malformed => ({ id, title, document: documentOf(title, blocks) })
const whole = (id: string, title: string, more: Partial<ResolvedDocument>): Malformed => ({
  id,
  title,
  document: { ...documentOf(title, [paragraph(title)]), ...more },
})
const nested = (depth: number): Block => (depth === 0 ? paragraph('deep') : { kind: 'section', blocks: [nested(depth - 1)] })
const field: Block = { kind: 'paragraph', runs: [{ field: 'pageNumber' }] }
const page = (more: object): Partial<ResolvedDocument> => ({
  page: untyped({ size: 'A4', orientation: 'portrait', margins: { top: 36, right: 40, bottom: 36, left: 40 }, ...more }),
})

/** The header of a PNG of `width` by `height` pixels, eight bits of grey each: a filter byte and its pixels a line. */
function grey(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 0, 0, 0, 0], 8)
  return header
}
/** A PNG of 4 by 4 pixels, 20 bytes of scanlines, and one of a single line of 260, 261 bytes. */
const [GREY, LINE] = [grey(4, 4), grey(260, 1)]
/** The 20 bytes of scanlines, all black, as the zlib stream a PNG holds them in: its header, its deflate data and the four bytes of its checksum. */
const SCANLINES = new Uint8Array(deflateSync(new Uint8Array(20)))
/** An image of the PNG of 4 by 4 pixels, or of `header`, with `data` as its image data: every chunk framed and summed as PNG frames one, so that only the data is wrong. */
const png = (id: string, data: readonly number[], header: Uint8Array = GREY): Image =>
  image({
    asset: {
      id,
      mediaType: 'image/png',
      bytes: pngOf([
        ['IHDR', header],
        ['IDAT', Uint8Array.from(data)],
        ['IEND', new Uint8Array(0)],
      ]),
    },
  })

export const MALFORMED: readonly Malformed[] = [
  body('table-in-columns', 'A table inside a columns block', { kind: 'columns', columns: [{ width: 'fill', blocks: [table()] }] }),
  whole('page-break-in-region', 'A page break in the page header', { pageHeader: [{ kind: 'pageBreak' }] }),
  body('page-break-kept', 'A page break in a keep-together block', { kind: 'keepTogether', blocks: [{ kind: 'pageBreak' }] }),
  body('page-break-in-column', 'A page break in a column', { kind: 'columns', columns: [{ width: 'fill', blocks: [{ kind: 'pageBreak' }] }] }),
  body('page-field-in-body', 'A page field in the body', field),
  whole('page-field-in-first-header', "A page field in page 1's own header", { firstPageHeader: [field] }),
  body('unknown-block', 'A block the document does not hold', untyped({ kind: 'barcode' })),
  whole('unknown-field', 'A field the document does not hold', { pageFooter: [untyped({ kind: 'paragraph', runs: [{ field: 'date' }] })] }),
  body(
    'unknown-baseline',
    'A run set off the line in a way the format does not name',
    untyped({ kind: 'paragraph', runs: [{ text: '2', baseline: 'ordinal' }] }),
  ),
  whole('baseline-on-a-field', 'A page field set off the line', {
    pageFooter: [untyped({ kind: 'paragraph', runs: [{ field: 'pageNumber', baseline: 'superscript' }] })],
  }),
  body('text-not-text', 'A run whose text is no string', untyped({ kind: 'paragraph', runs: [{ text: ['a', 'b'] }] })),
  body('text-in-no-script', 'A run in a script a report does not print', paragraph('Customer: 山田太郎')),
  body('text-bidi-control', 'A run with a bidirectional control', paragraph('a‮b')),
  body('font-unmapped', 'A paragraph in a font the report maps to nothing', paragraph('serif', { font: 'serif' })),
  body('font-unknown', 'A paragraph in a font token the format does not name', paragraph('display', { font: untyped('display') })),
  body('size-too-small', 'A paragraph smaller than the format allows', paragraph('tiny', { size: 0.001 })),
  body('size-too-large', 'A paragraph larger than the format allows', paragraph('huge', { size: 400 })),
  body('align-unknown', 'A paragraph aligned in a way the format does not name', paragraph('justified', { align: untyped('justify') })),
  body('colour-no-colour', 'A paragraph in a colour that is none', paragraph('red', { color: 'red' })),
  body('colour-upper-case', 'A paragraph in a colour written in upper case', paragraph('red', { color: '#FF0000' })),
  body('image-fit', 'An image fitted in a way the format does not name', image({ fit: untyped('stretch') })),
  body('image-no-size', 'An image of no width', image({ width: 0 })),
  body('image-too-wide', 'An image wider than the page', image({ width: 600, height: 600 })),
  body('image-in-column-too-wide', 'An image wider than its column', {
    kind: 'columns',
    columns: [
      { width: 20, blocks: [image()] },
      { width: 'fill', blocks: [] },
    ],
  }),
  body(
    'image-not-a-picture',
    'An image whose bytes are no picture',
    image({ asset: { id: 'broken', mediaType: 'image/png', bytes: new TextEncoder().encode('not a PNG') } }),
  ),
  body('image-declared-otherwise', 'A PNG declared a JPEG', image({ asset: { ...PNG, mediaType: 'image/jpeg' } })),
  body('image-png-checksum', 'A PNG whose image data is not what its checksum sums', png('summed', [...SCANLINES.slice(0, -1), SCANLINES.at(-1)! ^ 0xff])),
  body('image-png-bytes-after', 'A PNG with bytes after the end of its image data', png('trailed', [...SCANLINES, 1, 2, 3, 4, 5, 6, 7, 8])),
  body(
    'image-png-bytes-after-summed',
    'A PNG with bytes after the end of its image data that end in its checksum',
    png('resummed', [...SCANLINES, 1, 2, 3, 4, ...SCANLINES.slice(-4)]),
  ),
  // A stored block that is not the last, holding every scanline, and the checksum of twenty zeros: the block that ends the stream is missing.
  body(
    'image-png-cut-short',
    'A PNG whose image data ends before its last block',
    png('cut', [0x78, 0x01, 0x00, 0x14, 0x00, 0xeb, 0xff, ...new Uint8Array(20), 0x00, 0x14, 0x00, 0x01]),
  ),
  // What zlib refuses of a block and a decompressor that reads less of it inflates, checksum and all. A stored block, the last, of 20 bytes,
  // whose length is not followed by its complement, 0xffeb, over the scanlines and their checksum: by its length alone it is the picture.
  body(
    'image-png-stored-lengths',
    'A PNG whose stored block states a length and not its complement',
    png('stored', [0x78, 0x01, 0x01, 0x14, 0x00, 0x00, 0x00, ...new Uint8Array(20), 0x00, 0x14, 0x00, 0x01]),
  ),
  // A block of the fixed codes, the last: a byte of nothing, the length code 286 at a distance of one, and the end. Deflate's lengths stop
  // at 285; read as a length of 260, it is the 261 bytes of the one line the header promises, and the checksum is theirs.
  body(
    'image-png-length-code',
    'A PNG whose image data uses a length code deflate does not define',
    png('coded', [0x78, 0x01, 0x63, 0x18, 0x03, 0x00, 0x01, 0x05, 0x00, 0x01], LINE),
  ),
  // The scanlines as a gzip member: its ten bytes of header, the deflate data, their CRC-32 and their count. A decompressor that reads
  // the wrapper off the data, as pako does left to itself, inflates it; zlib asked for a zlib stream does not.
  body(
    'image-png-gzip',
    'A PNG whose image data is a gzip member, not a zlib stream',
    png('gzipped', [0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x63, 0x60, 0xc0, 0x04, 0x00, 0x8d, 0x9b, 0xd5, 0x0f, 0x14, 0x00, 0x00, 0x00]),
  ),
  body(
    'image-svg-as-saved',
    'An SVG as a drawing program saved it, never cleaned',
    image({ asset: { id: 'saved', mediaType: 'image/svg+xml', bytes: SVG_AS_SAVED } }),
  ),
  body('rectangle-no-size', 'A rectangle of no height', { kind: 'rectangle', width: 10, height: 0 }),
  body('rectangle-too-wide', 'A rectangle wider than the page', { kind: 'rectangle', width: 600, height: 10 }),
  body('rectangle-colour', 'A rectangle filled with no colour', { kind: 'rectangle', width: 10, height: 10, fill: 'blue' }),
  body('rule-no-thickness', 'A rule of no thickness', { kind: 'rule', thickness: 0 }),
  body('rule-colour', 'A rule in no colour', { kind: 'rule', thickness: 1, color: '#12' }),
  body('spacer-negative', 'A spacer of negative height', { kind: 'spacer', height: -1 }),
  body('columns-none', 'A columns block with no columns', { kind: 'columns', columns: [] }),
  body('column-no-width', 'A column of no width', { kind: 'columns', columns: [{ width: 0, blocks: [] }] }),
  body('columns-too-wide', 'Columns wider than the page', {
    kind: 'columns',
    columns: [
      { width: 300, blocks: [] },
      { width: 300, blocks: [] },
    ],
  }),
  body('section-border-no-thickness', 'A section with a border of no thickness', { kind: 'section', border: { thickness: 0, color: '#000000' }, blocks: [] }),
  body('section-border-colour', 'A section with a border in no colour', { kind: 'section', border: { thickness: 1, color: 'black' }, blocks: [] }),
  body('section-fill', 'A section filled with no colour', { kind: 'section', fill: 'grey', blocks: [] }),
  body('section-padding-negative', 'A section with negative padding', { kind: 'section', padding: -2, blocks: [] }),
  body('section-no-width', 'A section whose padding leaves its blocks no width', { kind: 'section', padding: 300, blocks: [paragraph('squeezed')] }),
  body('nested-too-deep', 'Sections nested past any report', nested(18)),
  whole('page-size', 'A paper the format does not name', page({ size: 'A3' })),
  whole('page-size-inherited', 'A paper named by a property every object has', page({ size: 'constructor' })),
  whole('page-orientation', 'An orientation the format does not name', page({ orientation: 'sideways' })),
  whole('page-margin-negative', 'A negative margin', page({ margins: { top: -1, right: 40, bottom: 36, left: 40 } })),
  whole('page-no-area', 'Margins that leave no printable area', page({ margins: { top: 36, right: 300, bottom: 36, left: 300 } })),
  whole('creation-date', 'A creation date that is no date', { info: { title: 'Dated', creationDate: 'yesterday' } }),
  whole('title-not-text', 'A title that is no text', { info: { title: untyped(7), creationDate: '2026-01-01T00:00:00Z' } }),
  body('table-no-columns', 'A table with no columns', table({ columns: [], header: [], rows: [] })),
  body(
    'table-column-align',
    'A table column aligned in a way the format does not name',
    table({
      columns: [
        { width: 100, align: untyped('justify') },
        { width: 'fill', align: 'right' },
      ],
    }),
  ),
  body('table-header-cells', 'A table whose header has a cell too few', table({ header: ['Key'] })),
  body('table-row-cells', 'A table row with a cell too many', table({ rows: [{ kind: 'detail', cells: ['a', 'b', 'c'] }] })),
  body('table-across-cells', 'A row across the table with two cells', table({ rows: [{ kind: 'groupHeader', cells: ['a', 'b'], across: true }] })),
  body('table-cell-styles', 'A row with a cell style too few', table({ rows: [{ kind: 'detail', cells: ['a', 'b'], cellStyles: [null] }] })),
  body('table-row-style', 'A row in a font the report maps to nothing', table({ rows: [{ kind: 'detail', cells: ['a', 'b'], style: { font: 'mono' } }] })),
  body('table-header-style', 'A header in a colour that is none', table({ headerStyle: { color: 'navy' } })),
  body('table-cell-text', 'A cell in a script a report does not print', table({ rows: [{ kind: 'detail', cells: ['東京', '1.00'] }] })),
  body('table-keeps-on-detail', 'A detail row that keeps rows', table({ rows: [{ kind: 'detail', cells: ['a', 'b'], keepWithRows: 2 }] })),
  body(
    'table-keeps-one',
    'A group header that keeps one row',
    table({
      rows: [
        { kind: 'groupHeader', cells: ['Group'], across: true, keepWithRows: 1 },
        { kind: 'detail', cells: ['a', 'b'] },
      ],
    }),
  ),
  body(
    'table-keeps-too-many',
    'A group header that keeps more rows than follow it',
    table({
      rows: [
        { kind: 'groupHeader', cells: ['Group'], across: true, keepWithRows: 3 },
        { kind: 'detail', cells: ['a', 'b'] },
        { kind: 'detail', cells: ['c', 'd'] },
      ],
    }),
  ),
  body(
    'table-column-narrow',
    'A table column no wider than its padding',
    table({
      columns: [
        { width: 8, align: 'left' },
        { width: 'fill', align: 'right' },
      ],
    }),
  ),
  body(
    'table-too-wide',
    'A table whose fixed columns are wider than the page',
    table({
      columns: [
        { width: 400, align: 'left' },
        { width: 400, align: 'right' },
      ],
    }),
  ),
]
