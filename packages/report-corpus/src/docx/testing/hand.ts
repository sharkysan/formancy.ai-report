import { crc32, deflateRawSync } from 'node:zlib'
import type { ResolvedDocument } from '../../document.js'
import { expectation, type Fixture } from '../../fixture.js'
import { encodePng } from '../../fixtures/png.js'

/**
 * A Word file written by hand, for the tests of the corpus's reader and
 * its checks (0068): the XML typed out below, part by part, and zipped
 * here with Node's zlib. Nothing in it comes from report-render-docx, so
 * a reader or a check that passes it was not taught by the writer what to
 * expect; and a test that takes one thing out of it sees whether the
 * check notices.
 */

/** One entry of a zip made by hand: what a test may write wrongly on purpose. */
export interface HandEntry {
  readonly name: string
  readonly bytes: Uint8Array | string
  /** Stored as it is; absent, deflated. */
  readonly stored?: boolean
  /** MS-DOS date and time; absent, 1 January 1980, 00:00:00. */
  readonly date?: number
  readonly time?: number
  /** The general purpose flags. */
  readonly flags?: number
  /** What the directory says the entry's CRC-32 is; absent, what it is. */
  readonly crc?: number
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

/** `entries` as a zip archive, each written as given; `comment` after the directory where a test wants an archive that does not end with it. */
export function zipOf(entries: readonly HandEntry[], comment = ''): Uint8Array {
  const chunks: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const raw = typeof entry.bytes === 'string' ? utf8(entry.bytes) : entry.bytes
    const data = entry.stored === true ? raw : deflateRawSync(raw)
    const name = utf8(entry.name)
    const common = new DataView(new ArrayBuffer(26))
    common.setUint16(0, 20, true)
    common.setUint16(2, entry.flags ?? 0, true)
    common.setUint16(4, entry.stored === true ? 0 : 8, true)
    common.setUint16(6, entry.time ?? 0, true)
    common.setUint16(8, entry.date ?? 0x0021, true)
    common.setUint32(10, entry.crc ?? crc32(raw), true)
    common.setUint32(14, data.length, true)
    common.setUint32(18, raw.length, true)
    common.setUint16(22, name.length, true)
    const local = new Uint8Array(30 + name.length)
    new DataView(local.buffer).setUint32(0, 0x04034b50, true)
    local.set(new Uint8Array(common.buffer), 4)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const view = new DataView(central.buffer)
    view.setUint32(0, 0x02014b50, true)
    view.setUint16(4, 20, true)
    central.set(new Uint8Array(common.buffer), 6)
    view.setUint32(42, offset, true)
    central.set(name, 46)
    chunks.push(local, data)
    directory.push(central)
    offset += local.length + data.length
  }
  const size = directory.reduce((sum, each) => sum + each.length, 0)
  const end = new Uint8Array(22 + comment.length)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, entries.length, true)
  view.setUint16(10, entries.length, true)
  view.setUint32(12, size, true)
  view.setUint32(16, offset, true)
  view.setUint16(20, comment.length, true)
  end.set(utf8(comment), 22)
  const all = [...chunks, ...directory, end]
  const bytes = new Uint8Array(all.reduce((sum, each) => sum + each.length, 0))
  let at = 0
  for (const each of all) {
    bytes.set(each, at)
    at += each.length
  }
  return bytes
}

/** A PNG of two pixels a side, which a box of 40 by 20 points contains at 20 by 20. */
export const HAND_PNG = encodePng(2, 2, (x, y) => [x * 255, y * 255, 128])

/** The document the hand-written file says: one of each block a Word file holds, on an A4 page with 50 points of margin. */
export const HAND_DOCUMENT: ResolvedDocument = {
  info: { title: 'Hand & <written>', creationDate: '2026-01-01T00:00:00Z' },
  page: { size: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
  pageHeader: [{ kind: 'paragraph', runs: [{ text: 'Hand-written file' }], style: { size: 8 } }],
  pageFooter: [
    { kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }], style: { size: 8, align: 'center' } },
  ],
  body: [
    { kind: 'paragraph', runs: [{ text: 'Heading' }], style: { size: 14, bold: true }, keepWithNext: true },
    {
      kind: 'paragraph',
      runs: [{ text: 'CO' }, { text: '2', baseline: 'subscript' }, { text: ' rises & <falls> ' }],
      style: { size: 10, italic: true, color: '#336699', align: 'right' },
    },
    { kind: 'image', asset: { id: 'dot', mediaType: 'image/png', bytes: HAND_PNG }, width: 40, height: 20, fit: 'contain' },
    { kind: 'rule', thickness: 1, color: '#999999' },
    { kind: 'spacer', height: 12 },
    {
      kind: 'table',
      id: 'lines',
      columns: [
        { width: 100, align: 'left' },
        { width: 'fill', align: 'right' },
      ],
      header: ['Key', 'Amount'],
      rows: [
        { kind: 'groupHeader', cells: ['Group A'], across: true, keepWithRows: 2 },
        { kind: 'detail', cells: ['ROW-1', '1.00'] },
        { kind: 'detail', cells: ['ROW-2', '2.00'] },
        { kind: 'total', cells: ['Total', '3.00'] },
      ],
      emptyText: 'No records',
    },
    { kind: 'rectangle', width: 30, height: 10, fill: '#ffcc00', stroke: '#000000' },
    {
      kind: 'columns',
      columns: [
        { width: 200, blocks: [{ kind: 'paragraph', runs: [{ text: 'Left' }] }] },
        { width: 'fill', blocks: [{ kind: 'paragraph', runs: [{ text: 'Right' }] }] },
      ],
    },
    { kind: 'section', border: { thickness: 1, color: '#1f4e79' }, fill: '#eef3f8', padding: 6, blocks: [{ kind: 'paragraph', runs: [{ text: 'Framed' }] }] },
    {
      kind: 'keepTogether',
      blocks: [
        { kind: 'paragraph', runs: [{ text: 'Kept one' }] },
        { kind: 'paragraph', runs: [{ text: 'Kept two' }] },
      ],
    },
    { kind: 'pageBreak' },
    { kind: 'paragraph', runs: [{ text: 'After the break' }] },
  ],
}

/** The hand-written file's document as a fixture, its expectation derived as every fixture's is. */
export const HAND: Fixture = {
  id: 'hand',
  title: 'One of each block a Word file holds, written by hand',
  document: HAND_DOCUMENT,
  maxPages: 2,
  expect: expectation(HAND_DOCUMENT, { maxPagesExpected: 2 }),
}

export const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
export const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
export const DRAWING =
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
export const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
export const TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

const FONT = '<w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/>'
/** A run's properties at `size` points, black unless `more` says otherwise before the size and after it. */
const set = (size: number, before = '<w:color w:val="000000"/>', after = ''): string =>
  `<w:rPr>${FONT}${before}<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/>${after}</w:rPr>`
export const mark = (size: number): string => `<w:rPr>${FONT}<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr>`
export const text = (words: string): string => `<w:t xml:space="preserve">${words}</w:t>`
export const TINY = '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>'
/** The paragraph a point tall that stands between two tables and ends a cell. */
export const HAND_SEPARATOR = `<w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`
export const plain = (words: string, properties = ''): string => `<w:p><w:pPr>${properties}${mark(10)}</w:pPr><w:r>${set(10)}${text(words)}</w:r></w:p>`
export const side = (name: string, weight: number, colour: string): string => `<w:${name} w:val="single" w:sz="${weight}" w:space="0" w:color="${colour}"/>`
export const margins = (x: number, y: number): string =>
  `<w:tblCellMar><w:top w:w="${y}" w:type="dxa"/><w:left w:w="${x}" w:type="dxa"/><w:bottom w:w="${y}" w:type="dxa"/><w:right w:w="${x}" w:type="dxa"/></w:tblCellMar>`
/** A cell of the table: its words at 9 points in a paragraph kept with the next where `kept`. */
const cell = (width: number, words: string, { kept = true, bold = false, right = false, more = '' } = {}): string =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${more}</w:tcPr><w:p><w:pPr>${kept ? '<w:keepNext/>' : ''}${right ? '<w:jc w:val="right"/>' : ''}${mark(9)}</w:pPr><w:r>${set(9, `${bold ? '<w:b/>' : ''}<w:color w:val="000000"/>`)}${text(words)}</w:r></w:p></w:tc>`
const field = (name: string): string =>
  `<w:r>${set(8)}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${set(8)}<w:instrText xml:space="preserve"> ${name} </w:instrText></w:r><w:r>${set(8)}<w:fldChar w:fldCharType="end"/></w:r>`

const ITALIC_BLUE = '<w:i/><w:color w:val="336699"/>'
const UNDER = `<w:tcBorders>${side('bottom', 4, '000000')}</w:tcBorders>`
const PICTURE =
  '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="254000" cy="254000"/><wp:docPr id="1" name="Picture 1"/>' +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Picture 1"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="254000" cy="254000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'

const BODY = [
  `<w:p><w:pPr><w:keepNext/>${mark(14)}</w:pPr><w:r>${set(14, '<w:b/><w:color w:val="000000"/>')}${text('Heading')}</w:r></w:p>`,
  `<w:p><w:pPr><w:jc w:val="right"/>${mark(10)}</w:pPr><w:r>${set(10, ITALIC_BLUE)}${text('CO')}</w:r><w:r>${set(10, ITALIC_BLUE, '<w:vertAlign w:val="subscript"/>')}${text('2')}</w:r><w:r>${set(10, ITALIC_BLUE)}${text(' rises &amp; &lt;falls&gt; ')}</w:r></w:p>`,
  `<w:p><w:pPr><w:ind w:left="200"/>${TINY}</w:pPr><w:r>${TINY}${PICTURE}</w:r></w:p>`,
  `<w:p><w:pPr><w:pBdr>${side('bottom', 8, '999999')}${side('between', 8, '999999')}</w:pBdr><w:spacing w:after="60" w:line="60" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`,
  `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`,
  `<w:tbl><w:tblPr><w:tblW w:w="9906" w:type="dxa"/><w:tblBorders>${side('top', 4, 'BFBFBF')}${side('bottom', 4, 'BFBFBF')}${side('insideH', 4, 'BFBFBF')}</w:tblBorders><w:tblLayout w:type="fixed"/>${margins(80, 40)}</w:tblPr>` +
    '<w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="7906"/></w:tblGrid>' +
    `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cell(2000, 'Key', { bold: true, more: UNDER })}${cell(7906, 'Amount', { bold: true, right: true, more: UNDER })}</w:tr>` +
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(9906, 'Group A', { bold: true, more: '<w:gridSpan w:val="2"/>' })}</w:tr>` +
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(2000, 'ROW-1')}${cell(7906, '1.00', { right: true })}</w:tr>` +
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(2000, 'ROW-2')}${cell(7906, '2.00', { right: true })}</w:tr>` +
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(2000, 'Total', { kept: false, bold: true })}${cell(7906, '3.00', { kept: false, bold: true, right: true })}</w:tr></w:tbl>`,
  HAND_SEPARATOR,
  `<w:tbl><w:tblPr><w:tblW w:w="600" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margins(0, 0)}</w:tblPr><w:tblGrid><w:gridCol w:w="600"/></w:tblGrid>` +
    `<w:tr><w:trPr><w:trHeight w:val="200" w:hRule="exact"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:tcBorders>${['top', 'left', 'bottom', 'right'].map((each) => side(each, 4, '000000')).join('')}</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="FFCC00"/></w:tcPr>${HAND_SEPARATOR}</w:tc></w:tr></w:tbl>`,
  HAND_SEPARATOR,
  `<w:tbl><w:tblPr><w:tblW w:w="9906" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margins(0, 0)}</w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="5906"/></w:tblGrid>` +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>${plain('Left')}</w:tc><w:tc><w:tcPr><w:tcW w:w="5906" w:type="dxa"/></w:tcPr>${plain('Right')}</w:tc></w:tr></w:tbl>`,
  HAND_SEPARATOR,
  `<w:tbl><w:tblPr><w:tblW w:w="9906" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margins(120, 120)}</w:tblPr><w:tblGrid><w:gridCol w:w="9906"/></w:tblGrid>` +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="9906" w:type="dxa"/><w:tcBorders>${['top', 'left', 'bottom', 'right'].map((each) => side(each, 8, '1F4E79')).join('')}</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="EEF3F8"/></w:tcPr>${plain('Framed')}</w:tc></w:tr></w:tbl>`,
  plain('Kept one', '<w:keepNext/><w:keepLines/>'),
  plain('Kept two', '<w:keepLines/>'),
  `<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:line="20" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`,
  plain('After the break'),
].join('')

export const SECTION =
  '<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:footerReference w:type="default" r:id="rId5"/>' +
  '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="1000" w:footer="1000" w:gutter="0"/></w:sectPr>'

export const relationships = (...targets: readonly (readonly [type: string, target: string])[]): string =>
  `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${targets.map(([type, target], index) => `<Relationship Id="rId${index + 1}" Type="${type}" Target="${target}"/>`).join('')}</Relationships>`

/** The hand-written file's parts by name, in the order they are zipped: a test changes one and zips them again. */
export function handParts(): Map<string, string | Uint8Array> {
  return new Map<string, string | Uint8Array>([
    [
      '[Content_Types].xml',
      `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
        `<Override PartName="/word/document.xml" ContentType="${MAIN}.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${MAIN}.styles+xml"/>` +
        `<Override PartName="/word/settings.xml" ContentType="${MAIN}.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="${MAIN}.fontTable+xml"/>` +
        `<Override PartName="/word/header1.xml" ContentType="${MAIN}.header+xml"/><Override PartName="/word/footer1.xml" ContentType="${MAIN}.footer+xml"/>` +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      relationships(
        [`${TYPE}/officeDocument`, 'word/document.xml'],
        ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'],
      ),
    ],
    [
      'docProps/core.xml',
      `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        '<dc:title>Hand &amp; &lt;written&gt;</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created></cp:coreProperties>',
    ],
    ['word/document.xml', `${DECLARATION}<w:document ${W} ${R} ${DRAWING}><w:body>${BODY}${SECTION}</w:body></w:document>`],
    [
      'word/_rels/document.xml.rels',
      relationships(
        [`${TYPE}/styles`, 'styles.xml'],
        [`${TYPE}/settings`, 'settings.xml'],
        [`${TYPE}/fontTable`, 'fontTable.xml'],
        [`${TYPE}/header`, 'header1.xml'],
        [`${TYPE}/footer`, 'footer1.xml'],
        [`${TYPE}/image`, 'media/image1.png'],
      ),
    ],
    [
      'word/styles.xml',
      `${DECLARATION}<w:styles ${W}><w:docDefaults><w:rPrDefault>${mark(10)}</w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`,
    ],
    [
      'word/settings.xml',
      `${DECLARATION}<w:settings ${W}><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    ],
    ['word/fontTable.xml', `${DECLARATION}<w:fonts ${W}><w:font w:name="Roboto"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>`],
    [
      'word/header1.xml',
      `${DECLARATION}<w:hdr ${W}><w:p><w:pPr>${mark(8)}</w:pPr><w:r>${set(8)}${text('Hand-written file')}</w:r></w:p><w:p><w:pPr><w:spacing w:line="120" w:lineRule="exact"/>${TINY}</w:pPr></w:p></w:hdr>`,
    ],
    [
      'word/footer1.xml',
      `${DECLARATION}<w:ftr ${W}><w:p><w:pPr><w:spacing w:line="120" w:lineRule="exact"/>${TINY}</w:pPr></w:p><w:p><w:pPr><w:jc w:val="center"/>${mark(8)}</w:pPr><w:r>${set(8)}${text('Page ')}</w:r>${field('PAGE')}<w:r>${set(8)}${text(' of ')}</w:r>${field('NUMPAGES')}</w:p></w:ftr>`,
    ],
    ['word/media/image1.png', HAND_PNG],
  ])
}

/** `parts` zipped as a package: the content types first, as a package's are. */
export function handDocx(parts: ReadonlyMap<string, string | Uint8Array> = handParts()): Uint8Array {
  return zipOf([...parts].map(([name, bytes]) => ({ name, bytes })))
}

/** `parts` with `from` in the part `name` written as `to`; throws unless it stands there exactly once, so that a test changes what it means to. */
export function rewritten(name: string, from: string, to: string, parts = handParts()): Map<string, string | Uint8Array> {
  const part = parts.get(name)
  if (typeof part !== 'string' || part.split(from).length !== 2) throw new Error(`'${from}' does not stand exactly once in ${name}`)
  return new Map(parts).set(
    name,
    part.replace(from, () => to),
  )
}
